const express = require('express');
const prisma = require('../lib/prisma');
const h = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const { candidateProfileOf, recruiterProfileOf } = require('../utils/owners');

const router = express.Router();

router.use(requireAuth);

// Real counts for each dashboard (they start at zero and grow with real data)
router.get('/candidate', requireRole('CANDIDATE'), h(async (req, res) => {
  const profile = await candidateProfileOf(req.user.id);
  const now = new Date();
  const [applications, active, resumes, unread, upcoming, feedback] = await Promise.all([
    prisma.application.count({ where: { candidateId: profile.id } }),
    prisma.application.count({ where: { candidateId: profile.id, status: { in: ['IN_PROGRESS', 'SHORTLISTED'] } } }),
    prisma.resume.count({ where: { candidateId: profile.id } }),
    prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
    prisma.scheduledEvent.findMany({
      where: { application: { candidateId: profile.id }, endsAt: { gte: now } },
      orderBy: { startsAt: 'asc' },
      take: 5,
    }),
    prisma.candidateFeedback.count({ where: { isReleased: true, application: { candidateId: profile.id } } }),
  ]);
  res.json({ applications, active, resumes, unreadNotifications: unread, upcoming, feedback });
}));

router.get('/recruiter', requireRole('RECRUITER'), h(async (req, res) => {
  const profile = await recruiterProfileOf(req.user.id);
  const mine = { job: { recruiterId: profile.id } };
  const [openJobs, applicants, shortlisted, hired, byStage, upcoming] = await Promise.all([
    prisma.job.count({ where: { recruiterId: profile.id, status: 'OPEN' } }),
    prisma.application.count({ where: mine }),
    prisma.application.count({ where: { ...mine, status: 'SHORTLISTED' } }),
    prisma.application.count({ where: { ...mine, status: 'HIRED' } }),
    prisma.application.groupBy({
      by: ['stage'],
      where: { ...mine, status: { in: ['IN_PROGRESS', 'SHORTLISTED'] } },
      _count: { _all: true },
    }),
    prisma.scheduledEvent.count({ where: { job: { recruiterId: profile.id }, endsAt: { gte: new Date() } } }),
  ]);
  const pipeline = {};
  for (const row of byStage) pipeline[row.stage] = row._count._all;
  res.json({ openJobs, applicants, shortlisted, hired, pipeline, upcomingEvents: upcoming });
}));

router.get('/admin', requireRole('ADMIN'), h(async (req, res) => {
  const [candidates, recruiters, jobs, questions, topics, applications] = await Promise.all([
    prisma.user.count({ where: { role: 'CANDIDATE' } }),
    prisma.user.count({ where: { role: 'RECRUITER' } }),
    prisma.job.count(),
    prisma.aptitudeQuestion.count({ where: { isActive: true } }),
    prisma.gDTopic.count({ where: { isActive: true } }),
    prisma.application.count(),
  ]);
  res.json({ candidates, recruiters, jobs, questions, topics, applications });
}));

module.exports = router;
