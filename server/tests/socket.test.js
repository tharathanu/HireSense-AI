// Live group discussion: joining, WebRTC signal relay and transcript saving
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

jest.mock('../src/lib/prisma', () => require('./helpers/prismaMock').createPrismaMock());

const http = require('http');
const { io: connect } = require('socket.io-client');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { initSocket } = require('../src/socket');
const { signToken } = require('../src/utils/tokens');

const users = {
  u_cand: { id: 'u_cand', role: 'CANDIDATE', fullName: 'Meera Iyer', isActive: true },
  u_cand2: { id: 'u_cand2', role: 'CANDIDATE', fullName: 'Arjun Rao', isActive: true },
  u_rec: { id: 'u_rec', role: 'RECRUITER', fullName: 'Ravi Menon', isActive: true },
  u_out: { id: 'u_out', role: 'CANDIDATE', fullName: 'Outsider', isActive: true },
};
const session = (status) => ({
  id: 'gd1', status,
  job: { blindScreening: false, recruiter: { userId: 'u_rec' } },
  participants: [
    { id: 'p1', applicationId: 'a1', application: { candidate: { userId: 'u_cand' } } },
    { id: 'p2', applicationId: 'a2', application: { candidate: { userId: 'u_cand2' } } },
  ],
});

let server;
let url;
const clients = [];

beforeAll((done) => {
  server = http.createServer(app);
  initSocket(server, ['http://localhost']);
  server.listen(0, () => {
    url = `http://localhost:${server.address().port}`;
    done();
  });
});
afterAll((done) => {
  clients.forEach((c) => c.close());
  server.close(done);
});
beforeEach(() => {
  prisma.__reset();
  prisma.user.findUnique.mockImplementation(async ({ where }) => users[where.id] || null);
  prisma.gDSession.findUnique.mockResolvedValue(session('LIVE'));
  prisma.gDTranscriptEntry.create.mockImplementation(async ({ data }) => ({ ...data, spokenAt: new Date() }));
});

function client(userId) {
  const c = connect(url, { auth: { token: signToken(users[userId]) }, transports: ['websocket'], forceNew: true });
  clients.push(c);
  return c;
}
const join = (c) => new Promise((resolve) => c.emit('gd:join', { sessionId: 'gd1' }, resolve));
const once = (c, event) => new Promise((resolve) => c.once(event, resolve));

test('rejects connections without a valid token', async () => {
  const c = connect(url, { auth: { token: 'bad' }, transports: ['websocket'], forceNew: true });
  clients.push(c);
  const err = await once(c, 'connect_error');
  expect(err.message).toBe('unauthorized');
});

test('only participants and the host can join', async () => {
  expect((await join(client('u_out'))).error).toMatch(/not part/);
  expect((await join(client('u_rec'))).ok).toBe(true);
});

test('relays WebRTC signals and broadcasts saved transcript lines', async () => {
  const a = client('u_cand');
  const b = client('u_cand2');
  await join(a);
  const joined = once(a, 'gd:peer-joined');
  const resB = await join(b);
  expect(resB.peers.some((p) => p.name === 'Meera Iyer')).toBe(true);
  const peer = await joined;
  expect(peer.name).toBe('Arjun Rao');

  const signal = once(b, 'gd:signal');
  a.emit('gd:signal', { to: peer.socketId, data: { type: 'offer', sdp: 'x' } });
  expect((await signal).data.type).toBe('offer');

  const line = once(b, 'gd:transcript');
  a.emit('gd:transcript', { text: 'I think remote work helps focus.' });
  const got = await line;
  expect(got).toMatchObject({ name: 'Meera Iyer', text: 'I think remote work helps focus.' });
  expect(prisma.gDTranscriptEntry.create.mock.calls[0][0].data.participantId).toBe('p1');
});

test('refuses to join a finished discussion', async () => {
  prisma.gDSession.findUnique.mockResolvedValue(session('COMPLETED'));
  expect((await join(client('u_cand'))).error).toMatch(/ended/);
});
