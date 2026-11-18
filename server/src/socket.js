// Real-time group discussion: WebRTC signalling and live transcript (Socket.IO)
const { Server } = require('socket.io');
const prisma = require('./lib/prisma');
const { verifyToken } = require('./utils/tokens');

let io = null;

function getIO() {
  return io;
}

function initSocket(httpServer, allowedOrigins) {
  io = new Server(httpServer, { cors: { origin: allowedOrigins } });

  // Every socket must carry a valid login token
  io.use(async (socket, next) => {
    try {
      const payload = verifyToken(socket.handshake.auth?.token || '');
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) return next(new Error('unauthorized'));
      socket.data.user = { id: user.id, role: user.role, fullName: user.fullName };
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('gd:join', async ({ sessionId }, ack) => {
      try {
        const session = await prisma.gDSession.findUnique({
          where: { id: sessionId },
          include: {
            job: { include: { recruiter: true } },
            participants: { include: { application: { include: { candidate: true } } } },
          },
        });
        if (!session) return ack?.({ error: 'Session not found.' });

        const user = socket.data.user;
        const isHost = session.job.recruiter.userId === user.id;
        const me = session.participants.find((p) => p.application.candidate.userId === user.id);
        if (!isHost && !me) return ack?.({ error: 'You are not part of this discussion.' });
        if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
          return ack?.({ error: 'This discussion has ended.' });
        }

        // Candidates in a discussion have already passed screening, so blind mode no longer applies
        const name = isHost ? `${user.fullName} (Recruiter)` : user.fullName;

        socket.data.gd = { sessionId, participantId: me?.id || null, isHost, name };
        const room = `gd:${sessionId}`;

        // Tell the newcomer who is already here, then tell everyone about the newcomer
        const peers = [];
        for (const s of await io.in(room).fetchSockets()) {
          peers.push({ socketId: s.id, name: s.data.gd?.name, isHost: s.data.gd?.isHost });
        }
        socket.join(room);
        socket.to(room).emit('gd:peer-joined', { socketId: socket.id, name, isHost });
        ack?.({ ok: true, peers, status: session.status, startedAt: session.startedAt });
      } catch {
        ack?.({ error: 'Could not join the discussion.' });
      }
    });

    // WebRTC offer / answer / ICE candidate relay
    socket.on('gd:signal', ({ to, data }) => {
      if (!socket.data.gd || typeof to !== 'string') return;
      io.to(to).emit('gd:signal', { from: socket.id, data });
    });

    // Speech-to-text chunks from candidates are saved and shared live
    socket.on('gd:transcript', async ({ text }) => {
      const gd = socket.data.gd;
      if (!gd || !gd.participantId || typeof text !== 'string') return;
      const clean = text.trim().slice(0, 1000);
      if (!clean) return;
      const session = await prisma.gDSession.findUnique({ where: { id: gd.sessionId } });
      if (!session || session.status !== 'LIVE') return;
      const entry = await prisma.gDTranscriptEntry.create({
        data: { sessionId: gd.sessionId, participantId: gd.participantId, text: clean },
      });
      io.to(`gd:${gd.sessionId}`).emit('gd:transcript', { name: gd.name, text: clean, at: entry.spokenAt });
    });

    socket.on('gd:media', ({ audio, video }) => {
      const gd = socket.data.gd;
      if (!gd) return;
      socket.to(`gd:${gd.sessionId}`).emit('gd:media', { socketId: socket.id, audio: Boolean(audio), video: Boolean(video) });
    });

    socket.on('disconnect', () => {
      const gd = socket.data.gd;
      if (gd) socket.to(`gd:${gd.sessionId}`).emit('gd:peer-left', { socketId: socket.id });
    });
  });

  return io;
}

module.exports = { initSocket, getIO };
