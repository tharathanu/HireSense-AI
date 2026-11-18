const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const h = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { recruiterProfileOf, recruiterApplication, recruiterJob } = require('../utils/owners');
const { maskCandidate } = require('../utils/blind');
const pipeline = require('../services/pipeline.service');
const { notify } = require('../services/notify.service');
const gdService = require('../services/gd.service');
const { getIO } = require('../socket');

const router = express.Router();
router.use(requireAuth, requireRole('RECRUITER'));

// ---------- Profile ----------

router.put(
  '/profile',
  validate(z.object({
    fullName: z.string().trim().min(2).max(80),
    designation: z.string().trim().max(80).optional().nullable(),
    companyName: z.string().trim().min(2).max(120),
    companyWebsite: z.string().trim().url('Enter a valid website link.').optional().or(z.literal('')).nullable(),
    industry: z.string().trim().max(80).optional().nullable(),
  })),
  h(async (req, res) => {
    const profile = await recruiterProfileOf(req.user.id);
    const { fullName, designation, companyName, companyWebsite, industry } = req.body;
    await prisma.user.update({ where: { id: req.user.id }, data: { fullName } });
    await prisma.recruiterProfile.update({ where: { id: profile.id }, data: { designation: designation || null } });
    await prisma.company.update({
      where: { id: profile.companyId },
      data: { name: companyName, website: companyWebsite || null, industry: industry || null },
    });
    res.json({ ok: true });
  })
);

// ---------- Jobs ----------

const jobSchema = z.object({
  title: z.string().trim().min(3, 'Enter a job title.').max(120),
  description: z.string().trim().min(30, 'Describe the role in at least 30 characters.').max(8000),
  location: z.string().trim().max(80).optional().nullable(),
  employmentType: z.string().trim().max(40).optional().nullable(),
  experienceLevel: z.string().trim().max(40).optional().nullable(),
  openings: z.coerce.number().int().min(1).max(500).default(1),
  blindScreening: z.boolean().default(false),
  aptitudeCutoff: z.coerce.number().int().min(0).max(100).default(60),
  closesAt: z.string().datetime({ offset: true }).optional().nullable().or(z.literal('')),
  status: z.enum(['DRAFT', 'OPEN', 'CLOSED']).default('DRAFT'),
  requiredSkillIds: z.array(z.string()).min(1, 'Choose at least one required skill.').max(20),
  optionalSkillIds: z.array(z.string()).max(20).default([]),
});

function jobData(body) {
  return {
    title: body.title,
    description: body.description,
    location: body.location || null,
    employmentType: body.employmentType || null,
    experienceLevel: body.experienceLevel || null,
    openings: body.openings,
    blindScreening: body.blindScreening,
    aptitudeCutoff: body.aptitudeCutoff,
    closesAt: body.closesAt ? new Date(body.closesAt) : null,
    status: body.status,
  };
}

function skillRows(body) {
  const required = [...new Set(body.requiredSkillIds)];
  const optional = [...new Set(body.optionalSkillIds)].filter((id) => !required.includes(id));
  return [
    ...required.map((skillId) => ({ skillId, isRequired: true })),
    ...optional.map((skillId) => ({ skillId, isRequired: false })),
  ];
}

router.get('/jobs', h(async (req, res) => {
  const profile = await recruiterProfileOf(req.user.id);
  const jobs = await prisma.job.findMany({
    where: { recruiterId: profile.id },
    orderBy: { createdAt: 'desc' },
    include: { skills: { include: { skill: true } }, _count: { select: { applications: true } } },
  });
  res.json({ jobs });
}));

router.get('/jobs/:id', h(async (req, res) => {
  await recruiterJob(req.user.id, req.params.id);
  const job = await prisma.job.findUnique({
    where: { id: req.params.id },
    include: { skills: { include: { skill: true } }, company: true },
  });
  res.json({ job });
}));

router.post('/jobs', validate(jobSchema), h(async (req, res) => {
  const profile = await recruiterProfileOf(req.user.id);
  const job = await prisma.job.create({
    data: {
      ...jobData(req.body),
      companyId: profile.companyId,
      recruiterId: profile.id,
      skills: { create: skillRows(req.body) },
    },
  });
  res.status(201).json({ job });
}));

router.put('/jobs/:id', validate(jobSchema), h(async (req, res) => {
  const job = await recruiterJob(req.user.id, req.params.id);
  await prisma.jobSkill.deleteMany({ where: { jobId: job.id } });
  const updated = await prisma.job.update({
    where: { id: job.id },
    data: { ...jobData(req.body), skills: { create: skillRows(req.body) } },
  });
  res.json({ job: updated });
}));

router.patch('/jobs/:id/status', validate(z.object({ status: z.enum(['DRAFT', 'OPEN', 'CLOSED']) })), h(async (req, res) => {
  const job = await recruiterJob(req.user.id, req.params.id);
  const updated = await prisma.job.update({ where: { id: job.id }, data: { status: req.body.status } });
  res.json({ job: updated });
}));

// ---------- Pipeline ----------

const PIPELINE_INCLUDE = {
  candidate: { include: { user: { select: { fullName: true, email: true } } } },
  resumeAnalysis: true,
  aptitudeAttempt: { select: { status: true, score: true } },
  gdParticipant: { select: { impactScore: true, sessionId: true } },
  interviewSession: { select: { status: true, overallScore: true } },
  finalReport: { select: { overallScore: true, recommendation: true } },
  _count: { select: { integrityLogs: true } },
};

router.get('/jobs/:id/applications', h(async (req, res) => {
  const job = await recruiterJob(req.user.id, req.params.id);
  const applications = await prisma.application.findMany({
    where: { jobId: job.id },
    orderBy: { appliedAt: 'desc' },
    include: PIPELINE_INCLUDE,
  });
  res.json({ job, applications: applications.map((a) => maskCandidate(a, job)) });
}));

router.get('/applications/:id', h(async (req, res) => {
  const app = await recruiterApplication(req.user.id, req.params.id, {
    candidate: { include: { user: { select: { fullName: true, email: true } } } },
    resume: { include: { authenticityChecks: true } },
    resumeAnalysis: true,
    aptitudeAttempt: { include: { answers: { include: { question: true }, orderBy: { orderIndex: 'asc' } } } },
    gdParticipant: { include: { session: { include: { topic: true } }, entries: { orderBy: { spokenAt: 'asc' } } } },
    interviewSession: { include: { questions: { orderBy: { orderIndex: 'asc' }, include: { answer: true } } } },
    integrityLogs: { orderBy: { occurredAt: 'asc' } },
    finalReport: true,
    feedback: true,
    stageHistory: { orderBy: { createdAt: 'asc' } },
    events: { orderBy: { startsAt: 'asc' } },
  });
  const masked = maskCandidate(app, app.job);
  if (masked.isBlind && masked.resume) masked.resume.authenticityChecks = app.resume?.authenticityChecks || [];
  res.json({ application: masked });
}));

router.post('/applications/:id/advance', h(async (req, res) => {
  const app = await recruiterApplication(req.user.id, req.params.id);
  res.json({ application: await pipeline.advance(app, req.user.id) });
}));

router.post('/applications/:id/reject', validate(z.object({ note: z.string().max(500).optional() })), h(async (req, res) => {
  const app = await recruiterApplication(req.user.id, req.params.id);
  res.json({ application: await pipeline.close(app, 'REJECTED', req.user.id, req.body.note) });
}));

router.post('/applications/:id/hire', validate(z.object({ note: z.string().max(500).optional() })), h(async (req, res) => {
  const app = await recruiterApplication(req.user.id, req.params.id);
  if (app.stage !== 'FINAL_REVIEW') throw new HttpError(400, 'Move the candidate to final review before hiring.');
  res.json({ application: await pipeline.close(app, 'HIRED', req.user.id, req.body.note) });
}));

router.post('/applications/:id/report', h(async (req, res) => {
  const app = await recruiterApplication(req.user.id, req.params.id);
  res.json({ report: await pipeline.generateReport(app.id) });
}));

router.post('/applications/:id/feedback', validate(z.object({ release: z.boolean().default(false) })), h(async (req, res) => {
  const app = await recruiterApplication(req.user.id, req.params.id);
  const feedback = await pipeline.generateFeedback(app.id, req.body.release);
  res.json({ feedback });
}));

router.get('/jobs/:id/ranking', h(async (req, res) => {
  const job = await recruiterJob(req.user.id, req.params.id);
  const applications = await prisma.application.findMany({
    where: { jobId: job.id, finalReport: { isNot: null } },
    include: {
      finalReport: true,
      candidate: { include: { user: { select: { fullName: true, email: true } } } },
    },
  });
  applications.sort((a, b) => b.finalReport.overallScore - a.finalReport.overallScore);
  res.json({ job, ranking: applications.map((a) => maskCandidate(a, job)) });
}));

// ---------- Group discussions ----------

router.get('/gd', h(async (req, res) => {
  const profile = await recruiterProfileOf(req.user.id);
  const sessions = await prisma.gDSession.findMany({
    where: { job: { recruiterId: profile.id } },
    orderBy: { scheduledAt: 'desc' },
    include: {
      job: { select: { id: true, title: true } },
      topic: true,
      participants: { include: { application: { include: { candidate: { include: { user: { select: { fullName: true } } } } } } } },
    },
  });
  res.json({ sessions });
}));

router.post(
  '/gd',
  validate(z.object({
    jobId: z.string().min(1),
    topicId: z.string().min(1),
    scheduledAt: z.string().datetime({ offset: true }),
    durationMinutes: z.coerce.number().int().min(5).max(60).default(15),
    applicationIds: z.array(z.string()).min(2, 'Choose at least 2 candidates.').max(8, 'A room can hold up to 8 candidates.'),
  })),
  h(async (req, res) => {
    const job = await recruiterJob(req.user.id, req.body.jobId);
    const topic = await prisma.gDTopic.findFirst({ where: { id: req.body.topicId, isActive: true } });
    if (!topic) throw new HttpError(404, 'Topic not found.');

    const apps = await prisma.application.findMany({
      where: { id: { in: req.body.applicationIds }, jobId: job.id, stage: 'GROUP_DISCUSSION', status: { in: ['IN_PROGRESS', 'SHORTLISTED'] } },
      include: { gdParticipant: true, candidate: true },
    });
    if (apps.length !== req.body.applicationIds.length) {
      throw new HttpError(400, 'Every selected candidate must be in the group discussion stage of this job.');
    }
    if (apps.some((a) => a.gdParticipant)) throw new HttpError(400, 'A selected candidate is already assigned to a discussion.');

    const startsAt = new Date(req.body.scheduledAt);
    const endsAt = new Date(startsAt.getTime() + req.body.durationMinutes * 60000);
    const session = await prisma.gDSession.create({
      data: {
        jobId: job.id,
        topicId: topic.id,
        scheduledAt: startsAt,
        durationMinutes: req.body.durationMinutes,
        participants: { create: apps.map((a) => ({ applicationId: a.id })) },
      },
    });

    for (const a of apps) {
      await prisma.scheduledEvent.create({
        data: {
          type: 'GROUP_DISCUSSION',
          jobId: job.id,
          applicationId: a.id,
          title: `Group discussion: ${job.title}`,
          startsAt,
          endsAt,
          joinPath: `/gd/${session.id}`,
        },
      });
      await notify(a.candidate.userId, {
        title: `Group discussion scheduled: ${job.title}`,
        message: `Your group discussion is on ${startsAt.toUTCString()}. Join from your schedule page with your camera and microphone ready. Use Google Chrome or Microsoft Edge.`,
        link: '/candidate/schedule',
      });
    }
    res.status(201).json({ session });
  })
);

async function ownSession(userId, sessionId) {
  const profile = await recruiterProfileOf(userId);
  const session = await prisma.gDSession.findFirst({
    where: { id: sessionId, job: { recruiterId: profile.id } },
    include: { topic: true, participants: { include: { entries: true } } },
  });
  if (!session) throw new HttpError(404, 'Session not found.');
  return session;
}

router.post('/gd/:id/start', h(async (req, res) => {
  const session = await ownSession(req.user.id, req.params.id);
  if (session.status !== 'SCHEDULED') throw new HttpError(400, 'This session cannot be started.');
  const updated = await prisma.gDSession.update({ where: { id: session.id }, data: { status: 'LIVE', startedAt: new Date() } });
  getIO()?.to(`gd:${session.id}`).emit('gd:status', { status: 'LIVE', startedAt: updated.startedAt });
  res.json({ session: updated });
}));

router.post('/gd/:id/end', h(async (req, res) => {
  const session = await ownSession(req.user.id, req.params.id);
  if (session.status !== 'LIVE') throw new HttpError(400, 'Only a live session can be ended.');

  let results = gdService.scoreDiscussion(session.participants, session.topic);
  results = await gdService.refineWithAI(results, session.participants, session.topic);
  for (const r of results) {
    await prisma.gDParticipant.update({
      where: { id: r.participantId },
      data: {
        turnCount: r.turnCount,
        speakingSeconds: r.speakingSeconds,
        impactScore: r.impactScore,
        relevanceScore: r.relevanceScore,
        leadershipScore: r.leadershipScore,
        summary: r.summary,
      },
    });
  }
  const updated = await prisma.gDSession.update({ where: { id: session.id }, data: { status: 'COMPLETED', endedAt: new Date() } });
  getIO()?.to(`gd:${session.id}`).emit('gd:status', { status: 'COMPLETED' });
  res.json({ session: updated, results });
}));

router.post('/gd/:id/cancel', h(async (req, res) => {
  const session = await ownSession(req.user.id, req.params.id);
  if (session.status === 'COMPLETED') throw new HttpError(400, 'A completed session cannot be cancelled.');
  await prisma.gDParticipant.deleteMany({ where: { sessionId: session.id } });
  await prisma.scheduledEvent.deleteMany({ where: { joinPath: `/gd/${session.id}` } });
  const updated = await prisma.gDSession.update({ where: { id: session.id }, data: { status: 'CANCELLED' } });
  getIO()?.to(`gd:${session.id}`).emit('gd:status', { status: 'CANCELLED' });
  res.json({ session: updated });
}));

// ---------- Scheduling ----------

router.get('/events', h(async (req, res) => {
  const profile = await recruiterProfileOf(req.user.id);
  const events = await prisma.scheduledEvent.findMany({
    where: { job: { recruiterId: profile.id } },
    orderBy: { startsAt: 'asc' },
    include: {
      job: { select: { title: true, blindScreening: true } },
      application: { include: { candidate: { include: { user: { select: { fullName: true } } } } } },
    },
  });
  res.json({
    events: events.map((e) => ({
      ...e,
      application: e.application ? maskCandidate(e.application, e.job) : null,
    })),
  });
}));

router.post(
  '/events',
  validate(z.object({
    applicationIds: z.array(z.string()).min(1, 'Choose at least one candidate.').max(100),
    type: z.enum(['APTITUDE_TEST', 'INTERVIEW']),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    note: z.string().max(300).optional(),
  })),
  h(async (req, res) => {
    const profile = await recruiterProfileOf(req.user.id);
    const startsAt = new Date(req.body.startsAt);
    const endsAt = new Date(req.body.endsAt);
    if (endsAt <= startsAt) throw new HttpError(400, 'The end time must be after the start time.', { endsAt: 'End must be after start.' });

    const stage = req.body.type === 'APTITUDE_TEST' ? 'APTITUDE' : 'INTERVIEW';
    const apps = await prisma.application.findMany({
      where: { id: { in: req.body.applicationIds }, job: { recruiterId: profile.id }, stage },
      include: { job: true, candidate: true },
    });
    if (apps.length !== req.body.applicationIds.length) {
      throw new HttpError(400, `Every selected candidate must be in the ${stage === 'APTITUDE' ? 'aptitude' : 'interview'} stage.`);
    }

    const label = req.body.type === 'APTITUDE_TEST' ? 'Aptitude test' : 'Voice interview';
    const created = [];
    for (const a of apps) {
      const event = await prisma.scheduledEvent.create({
        data: {
          type: req.body.type,
          jobId: a.jobId,
          applicationId: a.id,
          title: `${label}: ${a.job.title}`,
          startsAt,
          endsAt,
          joinPath: req.body.type === 'APTITUDE_TEST' ? `/candidate/aptitude/${a.id}` : `/candidate/interview/${a.id}`,
        },
      });
      created.push(event);
      await notify(a.candidate.userId, {
        title: `${label} scheduled: ${a.job.title}`,
        message: `Please complete your ${label.toLowerCase()} between ${startsAt.toUTCString()} and ${endsAt.toUTCString()}. ${req.body.note || ''}`.trim(),
        link: '/candidate/schedule',
      });
    }
    res.status(201).json({ events: created });
  })
);

module.exports = router;
