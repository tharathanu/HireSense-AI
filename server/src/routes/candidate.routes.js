const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const h = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { candidateProfileOf, ownApplication } = require('../utils/owners');
const resumeService = require('../services/resume.service');
const { runChecks } = require('../services/authenticity.service');
const { matchResumeToJob } = require('../services/match.service');
const { notify } = require('../services/notify.service');
const aptitude = require('../services/aptitude.service');
const interview = require('../services/interview.service');

const router = express.Router();
router.use(requireAuth, requireRole('CANDIDATE'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if ([resumeService.PDF, resumeService.DOCX].includes(file.mimetype)) return cb(null, true);
    cb(new HttpError(400, 'Only PDF and DOCX files are supported.'));
  },
});

// ---------- Profile ----------

const optionalUrl = z.string().trim().url('Enter a valid link.').optional().or(z.literal('')).nullable();
const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(80),
  phone: z.string().trim().max(20).optional().nullable(),
  location: z.string().trim().max(80).optional().nullable(),
  headline: z.string().trim().max(120).optional().nullable(),
  linkedinUrl: optionalUrl,
  githubUrl: optionalUrl,
  gender: z.string().trim().max(30).optional().nullable(),
  college: z.string().trim().max(120).optional().nullable(),
  degree: z.string().trim().max(120).optional().nullable(),
  graduationYear: z.coerce.number().int().min(1980).max(2040).optional().nullable(),
});

router.get('/profile', h(async (req, res) => {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId: req.user.id },
    include: { user: { select: { fullName: true, email: true } }, skills: { include: { skill: true } } },
  });
  res.json({ profile });
}));

router.put('/profile', validate(profileSchema), h(async (req, res) => {
  const { fullName, ...rest } = req.body;
  const data = {};
  for (const [k, v] of Object.entries(rest)) data[k] = v === '' ? null : v;
  await prisma.user.update({ where: { id: req.user.id }, data: { fullName } });
  const profile = await prisma.candidateProfile.update({ where: { userId: req.user.id }, data });
  res.json({ profile });
}));

// ---------- Resumes ----------

router.post('/resumes', upload.single('file'), h(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Choose a PDF or DOCX file to upload.');
  const profile = await candidateProfileOf(req.user.id);

  const text = await resumeService.extractText(req.file.buffer, req.file.mimetype);
  const allSkills = await prisma.skill.findMany();
  const parsed = await resumeService.parseResume(text, allSkills.map((s) => s.name));

  await prisma.resume.updateMany({ where: { candidateId: profile.id }, data: { isPrimary: false } });
  const resume = await prisma.resume.create({
    data: {
      candidateId: profile.id,
      fileName: req.file.originalname.slice(0, 200),
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      extractedText: text,
      parsedData: parsed,
      isPrimary: true,
    },
  });

  // Refresh the candidate's skills from the new resume
  const found = allSkills.filter((s) => parsed.skills.includes(s.name));
  await prisma.candidateSkill.deleteMany({ where: { candidateId: profile.id, source: 'RESUME' } });
  if (found.length) {
    await prisma.candidateSkill.createMany({
      data: found.map((s) => ({ candidateId: profile.id, skillId: s.id, source: 'RESUME' })),
      skipDuplicates: true,
    });
  }

  // Fill empty profile links from the resume
  const profileUpdate = {};
  if (!profile.githubUrl && parsed.githubUrl) profileUpdate.githubUrl = parsed.githubUrl;
  if (!profile.linkedinUrl && parsed.linkedinUrl) profileUpdate.linkedinUrl = parsed.linkedinUrl;
  if (!profile.phone && parsed.phone) profileUpdate.phone = parsed.phone;
  if (Object.keys(profileUpdate).length) {
    await prisma.candidateProfile.update({ where: { id: profile.id }, data: profileUpdate });
  }

  const checks = await runChecks(parsed);
  await prisma.authenticityCheck.createMany({ data: checks.map((c) => ({ ...c, resumeId: resume.id })) });

  const full = await prisma.resume.findUnique({ where: { id: resume.id }, include: { authenticityChecks: true } });
  res.status(201).json({ resume: full });
}));

router.get('/resumes', h(async (req, res) => {
  const profile = await candidateProfileOf(req.user.id);
  const resumes = await prisma.resume.findMany({
    where: { candidateId: profile.id },
    orderBy: { createdAt: 'desc' },
    include: { authenticityChecks: true },
  });
  res.json({ resumes });
}));

// ---------- Applications ----------

router.post('/applications', validate(z.object({ jobId: z.string().min(1) })), h(async (req, res) => {
  const profile = await candidateProfileOf(req.user.id);
  const job = await prisma.job.findUnique({
    where: { id: req.body.jobId },
    include: { skills: { include: { skill: true } }, recruiter: true },
  });
  if (!job || job.status !== 'OPEN') throw new HttpError(404, 'This job is not accepting applications.');
  if (job.closesAt && new Date(job.closesAt) < new Date()) throw new HttpError(400, 'Applications for this job have closed.');

  const resume = await prisma.resume.findFirst({ where: { candidateId: profile.id, isPrimary: true } });
  if (!resume) throw new HttpError(400, 'Upload your resume before applying.');

  const existing = await prisma.application.findUnique({ where: { candidateId_jobId: { candidateId: profile.id, jobId: job.id } } });
  if (existing) throw new HttpError(409, 'You have already applied for this job.');

  const application = await prisma.application.create({
    data: { candidateId: profile.id, jobId: job.id, resumeId: resume.id },
  });
  await prisma.stageHistory.create({
    data: { applicationId: application.id, toStage: 'SCREENING', status: 'IN_PROGRESS', changedById: req.user.id, note: 'Applied' },
  });

  const skills = job.skills.map((js) => ({ name: js.skill.name, isRequired: js.isRequired }));
  const match = await matchResumeToJob(resume.parsedData || {}, resume.extractedText, job, skills);
  await prisma.resumeAnalysis.create({ data: { applicationId: application.id, ...match } });

  await notify(job.recruiter.userId, {
    title: `New applicant for ${job.title}`,
    message: `A candidate applied with a job-fit score of ${match.fitScore}.`,
    link: `/recruiter/jobs/${job.id}`,
    email: false,
  });

  res.status(201).json({ application: { ...application, resumeAnalysis: match } });
}));

router.get('/applications', h(async (req, res) => {
  const profile = await candidateProfileOf(req.user.id);
  const applications = await prisma.application.findMany({
    where: { candidateId: profile.id },
    orderBy: { appliedAt: 'desc' },
    include: {
      job: { include: { company: true } },
      resumeAnalysis: true,
      aptitudeAttempt: { select: { status: true, score: true, durationMinutes: true, questionCount: true } },
      gdParticipant: { include: { session: { include: { topic: true } } } },
      interviewSession: { select: { status: true, overallScore: true } },
      feedback: { select: { isReleased: true } },
      events: { orderBy: { startsAt: 'asc' } },
    },
  });
  res.json({ applications });
}));

router.post('/applications/:id/withdraw', h(async (req, res) => {
  const app = await ownApplication(req.user.id, req.params.id);
  if (['HIRED', 'REJECTED', 'WITHDRAWN'].includes(app.status)) throw new HttpError(400, 'This application is already closed.');
  const updated = await prisma.application.update({ where: { id: app.id }, data: { status: 'WITHDRAWN' } });
  await prisma.stageHistory.create({
    data: { applicationId: app.id, fromStage: app.stage, toStage: app.stage, status: 'WITHDRAWN', changedById: req.user.id },
  });
  res.json({ application: updated });
}));

// ---------- Aptitude test ----------

function assertStage(app, stage) {
  if (app.stage !== stage || ['REJECTED', 'WITHDRAWN', 'HIRED'].includes(app.status)) {
    throw new HttpError(403, 'This round is not open for your application.');
  }
}

async function finishAttempt(attemptId, status) {
  const answers = await prisma.aptitudeAnswer.findMany({
    where: { attemptId, isCorrect: { not: null } },
    include: { question: true },
  });
  const { score, categoryScores } = aptitude.scoreAttempt(answers);
  return prisma.aptitudeAttempt.update({
    where: { id: attemptId },
    data: { status, score, categoryScores, submittedAt: new Date() },
  });
}

async function loadAttempt(req) {
  const app = await ownApplication(req.user.id, req.params.applicationId, { aptitudeAttempt: true });
  if (!app.aptitudeAttempt) throw new HttpError(403, 'The aptitude test is not open for this application.');
  return { app, attempt: app.aptitudeAttempt };
}

router.get('/aptitude/:applicationId', h(async (req, res) => {
  const { app, attempt } = await loadAttempt(req);
  let current = attempt;
  if (attempt.status === 'IN_PROGRESS' && aptitude.isExpired(attempt)) {
    current = await finishAttempt(attempt.id, 'AUTO_SUBMITTED');
  }
  const answered = await prisma.aptitudeAnswer.count({ where: { attemptId: attempt.id, isCorrect: { not: null } } });
  res.json({
    job: { title: app.job.title },
    attempt: { ...current, secondsLeft: aptitude.secondsLeft(current), answered },
  });
}));

router.post('/aptitude/:applicationId/start', h(async (req, res) => {
  const { app, attempt } = await loadAttempt(req);
  assertStage(app, 'APTITUDE');
  if (attempt.status !== 'NOT_STARTED') throw new HttpError(400, 'This test has already been started.');
  const bankSize = await prisma.aptitudeQuestion.count({ where: { isActive: true } });
  if (bankSize < 5) throw new HttpError(503, 'The question bank is not ready yet. Please contact the recruiter.');
  const updated = await prisma.aptitudeAttempt.update({
    where: { id: attempt.id },
    data: { status: 'IN_PROGRESS', startedAt: new Date(), questionCount: Math.min(attempt.questionCount, bankSize) },
  });
  res.json({ attempt: { ...updated, secondsLeft: aptitude.secondsLeft(updated) } });
}));

// Returns the current unanswered question, or serves the next adaptive one
router.get('/aptitude/:applicationId/question', h(async (req, res) => {
  const { attempt } = await loadAttempt(req);
  if (attempt.status !== 'IN_PROGRESS') throw new HttpError(400, 'This test is not in progress.');
  if (aptitude.isExpired(attempt)) {
    await finishAttempt(attempt.id, 'AUTO_SUBMITTED');
    return res.json({ done: true, reason: 'TIME_UP' });
  }

  const answers = await prisma.aptitudeAnswer.findMany({
    where: { attemptId: attempt.id },
    orderBy: { orderIndex: 'asc' },
    include: { question: true },
  });
  let current = answers.find((a) => a.isCorrect === null);

  if (!current) {
    if (answers.length >= attempt.questionCount) return res.json({ done: true, reason: 'ALL_ANSWERED' });
    const bank = await prisma.aptitudeQuestion.findMany({
      where: { isActive: true },
      select: { id: true, category: true, difficulty: true },
    });
    const next = aptitude.pickNextQuestion(answers, bank);
    if (!next) return res.json({ done: true, reason: 'ALL_ANSWERED' });
    current = await prisma.aptitudeAnswer.create({
      data: { attemptId: attempt.id, questionId: next.id, orderIndex: answers.length },
      include: { question: true },
    });
  }

  res.json({
    done: false,
    answerId: current.id,
    number: current.orderIndex + 1,
    total: attempt.questionCount,
    secondsLeft: aptitude.secondsLeft(attempt),
    question: {
      category: current.question.category,
      difficulty: current.question.difficulty,
      text: current.question.question,
      options: current.question.options,
    },
  });
}));

router.post(
  '/aptitude/:applicationId/answer',
  validate(z.object({ answerId: z.string().min(1), selectedIndex: z.number().int().min(0).max(9) })),
  h(async (req, res) => {
    const { attempt } = await loadAttempt(req);
    if (attempt.status !== 'IN_PROGRESS') throw new HttpError(400, 'This test is not in progress.');
    if (aptitude.isExpired(attempt)) {
      await finishAttempt(attempt.id, 'AUTO_SUBMITTED');
      return res.json({ done: true, reason: 'TIME_UP' });
    }
    const answer = await prisma.aptitudeAnswer.findFirst({
      where: { id: req.body.answerId, attemptId: attempt.id },
      include: { question: true },
    });
    if (!answer) throw new HttpError(404, 'Question not found.');
    if (answer.isCorrect !== null) throw new HttpError(400, 'This question has already been answered.');
    if (req.body.selectedIndex >= answer.question.options.length) throw new HttpError(400, 'Invalid option.');

    await prisma.aptitudeAnswer.update({
      where: { id: answer.id },
      data: {
        selectedIndex: req.body.selectedIndex,
        isCorrect: req.body.selectedIndex === answer.question.correctIndex,
        answeredAt: new Date(),
      },
    });
    const answered = await prisma.aptitudeAnswer.count({ where: { attemptId: attempt.id, isCorrect: { not: null } } });
    if (answered >= attempt.questionCount) {
      const finished = await finishAttempt(attempt.id, 'SUBMITTED');
      return res.json({ done: true, reason: 'ALL_ANSWERED', score: finished.score });
    }
    res.json({ done: false, answered });
  })
);

router.post('/aptitude/:applicationId/submit', h(async (req, res) => {
  const { attempt } = await loadAttempt(req);
  if (attempt.status !== 'IN_PROGRESS') throw new HttpError(400, 'This test is not in progress.');
  const finished = await finishAttempt(attempt.id, 'SUBMITTED');
  res.json({ attempt: finished });
}));

// ---------- Voice interview ----------

async function loadInterview(req) {
  const app = await ownApplication(req.user.id, req.params.applicationId, {
    interviewSession: { include: { questions: { orderBy: { orderIndex: 'asc' }, include: { answer: true } } } },
    resume: true,
  });
  if (!app.interviewSession) throw new HttpError(403, 'The interview is not open for this application.');
  return { app, session: app.interviewSession };
}

function publicInterview(session) {
  return {
    id: session.id,
    status: session.status,
    overallScore: session.status === 'COMPLETED' ? session.overallScore : null,
    questions: session.questions.map((q) => ({
      id: q.id,
      orderIndex: q.orderIndex,
      question: q.question,
      focusArea: q.focusArea,
      answered: Boolean(q.answer),
    })),
  };
}

router.get('/interview/:applicationId', h(async (req, res) => {
  const { app, session } = await loadInterview(req);
  res.json({ job: { title: app.job.title }, session: publicInterview(session) });
}));

router.post('/interview/:applicationId/start', h(async (req, res) => {
  const { app, session } = await loadInterview(req);
  assertStage(app, 'INTERVIEW');
  if (session.status === 'COMPLETED') throw new HttpError(400, 'This interview is already complete.');

  if (session.questions.length === 0) {
    const job = await prisma.job.findUnique({ where: { id: app.jobId }, include: { skills: { include: { skill: true } } } });
    const skills = job.skills.map((js) => ({ name: js.skill.name, isRequired: js.isRequired }));
    const questions = await interview.generateQuestions(job, skills, app.resume?.parsedData, app.resume?.extractedText);
    await prisma.interviewQuestion.createMany({
      data: questions.map((q, i) => ({
        sessionId: session.id,
        orderIndex: i,
        question: q.question,
        focusArea: q.focusArea || null,
        expectedPoints: q.expectedPoints || [],
      })),
    });
  }
  await prisma.interviewSession.update({
    where: { id: session.id },
    data: { status: 'LIVE', startedAt: session.startedAt || new Date() },
  });
  const { session: fresh } = await loadInterview(req);
  res.json({ session: publicInterview(fresh) });
}));

router.post(
  '/interview/:applicationId/answer',
  validate(z.object({
    questionId: z.string().min(1),
    transcript: z.string().max(8000),
    durationSec: z.number().int().min(0).max(1800),
  })),
  h(async (req, res) => {
    const { session } = await loadInterview(req);
    if (session.status !== 'LIVE') throw new HttpError(400, 'The interview is not in progress.');
    const question = session.questions.find((q) => q.id === req.body.questionId);
    if (!question) throw new HttpError(404, 'Question not found.');
    if (question.answer) throw new HttpError(400, 'This question has already been answered.');

    const scores = await interview.scoreAnswerWithAI(question, req.body.transcript, req.body.durationSec);
    await prisma.interviewAnswer.create({
      data: { questionId: question.id, transcript: req.body.transcript, durationSec: req.body.durationSec, ...scores },
    });
    res.json({ saved: true });
  })
);

router.post('/interview/:applicationId/finish', h(async (req, res) => {
  const { session } = await loadInterview(req);
  if (session.status === 'COMPLETED') return res.json({ session: publicInterview(session) });
  const answers = session.questions.map((q) => q.answer).filter(Boolean);
  const overallScore = interview.overallInterviewScore(answers);
  await prisma.interviewSession.update({
    where: { id: session.id },
    data: { status: 'COMPLETED', endedAt: new Date(), overallScore },
  });
  const { session: fresh } = await loadInterview(req);
  res.json({ session: publicInterview(fresh) });
}));

// ---------- Schedule & feedback ----------

router.get('/events', h(async (req, res) => {
  const profile = await candidateProfileOf(req.user.id);
  const events = await prisma.scheduledEvent.findMany({
    where: { application: { candidateId: profile.id } },
    orderBy: { startsAt: 'asc' },
    include: { job: { include: { company: true } } },
  });
  res.json({ events });
}));

router.get('/feedback', h(async (req, res) => {
  const profile = await candidateProfileOf(req.user.id);
  const feedback = await prisma.candidateFeedback.findMany({
    where: { isReleased: true, application: { candidateId: profile.id } },
    orderBy: { createdAt: 'desc' },
    include: {
      application: {
        include: {
          job: { include: { company: true } },
          resumeAnalysis: true,
          aptitudeAttempt: { select: { score: true, categoryScores: true } },
          gdParticipant: { select: { impactScore: true } },
          interviewSession: { select: { overallScore: true } },
        },
      },
    },
  });
  res.json({ feedback });
}));

module.exports = router;
