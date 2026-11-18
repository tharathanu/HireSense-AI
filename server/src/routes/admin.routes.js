const express = require('express');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const h = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const validate = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('ADMIN'));

// ---------- Users ----------

router.get('/users', h(async (req, res) => {
  const role = ['CANDIDATE', 'RECRUITER', 'ADMIN'].includes(req.query.role) ? req.query.role : undefined;
  const q = (req.query.q || '').toString().trim().slice(0, 80);
  const users = await prisma.user.findMany({
    where: {
      ...(role ? { role } : {}),
      ...(q ? { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true, fullName: true, email: true, role: true, isActive: true, createdAt: true, lastLoginAt: true,
      recruiterProfile: { select: { company: { select: { name: true } } } },
    },
  });
  res.json({ users });
}));

router.patch('/users/:id', validate(z.object({ isActive: z.boolean() })), h(async (req, res) => {
  if (req.params.id === req.user.id) throw new HttpError(400, 'You cannot deactivate your own account.');
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { isActive: req.body.isActive },
    select: { id: true, isActive: true },
  });
  res.json({ user });
}));

// ---------- Aptitude question bank ----------

const questionSchema = z.object({
  category: z.enum(['QUANTITATIVE', 'LOGICAL', 'VERBAL', 'TECHNICAL']),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  question: z.string().trim().min(10, 'Write the question.').max(1000),
  options: z.array(z.string().trim().min(1, 'Options cannot be empty.').max(300)).min(2).max(6),
  correctIndex: z.number().int().min(0),
  explanation: z.string().trim().max(1000).optional().nullable(),
  isActive: z.boolean().default(true),
}).refine((d) => d.correctIndex < d.options.length, { message: 'Choose the correct option.', path: ['correctIndex'] });

router.get('/questions', h(async (req, res) => {
  const questions = await prisma.aptitudeQuestion.findMany({ orderBy: [{ category: 'asc' }, { difficulty: 'asc' }, { createdAt: 'desc' }] });
  res.json({ questions });
}));

router.post('/questions', validate(questionSchema), h(async (req, res) => {
  res.status(201).json({ question: await prisma.aptitudeQuestion.create({ data: req.body }) });
}));

router.put('/questions/:id', validate(questionSchema), h(async (req, res) => {
  res.json({ question: await prisma.aptitudeQuestion.update({ where: { id: req.params.id }, data: req.body }) });
}));

// Questions already used in tests are deactivated instead of deleted
router.delete('/questions/:id', h(async (req, res) => {
  const used = await prisma.aptitudeAnswer.count({ where: { questionId: req.params.id } });
  if (used) {
    await prisma.aptitudeQuestion.update({ where: { id: req.params.id }, data: { isActive: false } });
    return res.json({ deactivated: true });
  }
  await prisma.aptitudeQuestion.delete({ where: { id: req.params.id } });
  res.json({ deleted: true });
}));

// ---------- GD topics ----------

const topicSchema = z.object({
  title: z.string().trim().min(5, 'Write the topic.').max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  category: z.string().trim().max(60).optional().nullable(),
  isActive: z.boolean().default(true),
});

router.get('/topics', h(async (req, res) => {
  res.json({ topics: await prisma.gDTopic.findMany({ orderBy: { createdAt: 'desc' } }) });
}));

router.post('/topics', validate(topicSchema), h(async (req, res) => {
  res.status(201).json({ topic: await prisma.gDTopic.create({ data: req.body }) });
}));

router.put('/topics/:id', validate(topicSchema), h(async (req, res) => {
  res.json({ topic: await prisma.gDTopic.update({ where: { id: req.params.id }, data: req.body }) });
}));

router.delete('/topics/:id', h(async (req, res) => {
  const used = await prisma.gDSession.count({ where: { topicId: req.params.id } });
  if (used) {
    await prisma.gDTopic.update({ where: { id: req.params.id }, data: { isActive: false } });
    return res.json({ deactivated: true });
  }
  await prisma.gDTopic.delete({ where: { id: req.params.id } });
  res.json({ deleted: true });
}));

// ---------- Jobs overview ----------

router.get('/jobs', h(async (req, res) => {
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { company: true, _count: { select: { applications: true } } },
  });
  res.json({ jobs });
}));

router.patch('/jobs/:id', validate(z.object({ status: z.enum(['DRAFT', 'OPEN', 'CLOSED']) })), h(async (req, res) => {
  res.json({ job: await prisma.job.update({ where: { id: req.params.id }, data: { status: req.body.status } }) });
}));

// ---------- Email log ----------

router.get('/emails', h(async (req, res) => {
  res.json({ emails: await prisma.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }) });
}));

module.exports = router;
