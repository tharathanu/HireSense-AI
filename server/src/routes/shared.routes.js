// Routes for any logged-in user: notifications, integrity logs, GD room details
const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const h = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ownApplication } = require('../utils/owners');
const aptitude = require('../services/aptitude.service');

const router = express.Router();
router.use(requireAuth);

// ---------- Notifications ----------

router.get('/notifications', h(async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const unread = notifications.filter((n) => !n.isRead).length;
  res.json({ notifications, unread });
}));

router.post('/notifications/:id/read', h(async (req, res) => {
  await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { isRead: true } });
  res.json({ ok: true });
}));

router.post('/notifications/read-all', h(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } });
  res.json({ ok: true });
}));

// ---------- Proctoring / integrity ----------

const TAB_SWITCH_LIMIT = 3;

router.post(
  '/integrity',
  requireRole('CANDIDATE'),
  validate(z.object({
    applicationId: z.string().min(1),
    stage: z.enum(['APTITUDE', 'GROUP_DISCUSSION', 'INTERVIEW']),
    type: z.enum(['TAB_SWITCH', 'FULLSCREEN_EXIT', 'COPY_PASTE', 'PHONE_DETECTED', 'NO_FACE', 'MULTIPLE_FACES', 'LOOKING_AWAY', 'CAMERA_OFF']),
    detail: z.string().max(300).optional(),
  })),
  h(async (req, res) => {
    const app = await ownApplication(req.user.id, req.body.applicationId, { aptitudeAttempt: true });
    await prisma.integrityLog.create({
      data: { applicationId: app.id, stage: req.body.stage, type: req.body.type, detail: req.body.detail || null },
    });

    // Three tab switches during the aptitude test submits it automatically
    const attempt = app.aptitudeAttempt;
    if (req.body.stage === 'APTITUDE' && req.body.type === 'TAB_SWITCH' && attempt?.status === 'IN_PROGRESS') {
      const updated = await prisma.aptitudeAttempt.update({
        where: { id: attempt.id },
        data: { tabSwitchCount: { increment: 1 } },
      });
      if (updated.tabSwitchCount >= TAB_SWITCH_LIMIT) {
        const answers = await prisma.aptitudeAnswer.findMany({
          where: { attemptId: attempt.id, isCorrect: { not: null } },
          include: { question: true },
        });
        const { score, categoryScores } = aptitude.scoreAttempt(answers);
        await prisma.aptitudeAttempt.update({
          where: { id: attempt.id },
          data: { status: 'AUTO_SUBMITTED', score, categoryScores, submittedAt: new Date() },
        });
        return res.json({ logged: true, strikes: updated.tabSwitchCount, autoSubmitted: true });
      }
      return res.json({ logged: true, strikes: updated.tabSwitchCount, limit: TAB_SWITCH_LIMIT });
    }
    res.json({ logged: true });
  })
);

// ---------- GD room details ----------

router.get('/gd/:id', h(async (req, res) => {
  const session = await prisma.gDSession.findUnique({
    where: { id: req.params.id },
    include: {
      topic: true,
      job: { include: { recruiter: true } },
      participants: {
        include: {
          application: { include: { candidate: { include: { user: { select: { id: true, fullName: true } } } } } },
        },
      },
    },
  });
  if (!session) throw new HttpError(404, 'Session not found.');

  const isHost = req.user.role === 'RECRUITER' && session.job.recruiter.userId === req.user.id;
  const me = session.participants.find((p) => p.application.candidate.user.id === req.user.id);
  if (!isHost && !me) throw new HttpError(403, 'You are not part of this discussion.');

  res.json({
    session: {
      id: session.id,
      status: session.status,
      scheduledAt: session.scheduledAt,
      startedAt: session.startedAt,
      durationMinutes: session.durationMinutes,
      jobTitle: session.job.title,
      topic: { title: session.topic.title, description: session.topic.description },
      participants: session.participants.map((p) => ({
        id: p.id,
        applicationId: isHost ? p.applicationId : undefined,
        name: p.application.candidate.user.fullName,
      })),
    },
    role: isHost ? 'HOST' : 'PARTICIPANT',
    participantId: me?.id || null,
    applicationId: me?.applicationId || null,
  });
}));

module.exports = router;
