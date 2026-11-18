// Routes any visitor or logged-in user can call
const express = require('express');
const prisma = require('../lib/prisma');
const h = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');

const router = express.Router();

router.get('/skills', h(async (req, res) => {
  const skills = await prisma.skill.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  res.json({ skills });
}));

router.get('/jobs', h(async (req, res) => {
  const q = (req.query.q || '').toString().trim().slice(0, 80);
  const where = {
    status: 'OPEN',
    OR: [{ closesAt: null }, { closesAt: { gte: new Date() } }],
  };
  if (q) {
    where.AND = [{
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { company: { name: { contains: q, mode: 'insensitive' } } },
        { skills: { some: { skill: { name: { contains: q, mode: 'insensitive' } } } } },
      ],
    }];
  }
  const jobs = await prisma.job.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { company: true, skills: { include: { skill: true } } },
  });
  res.json({ jobs });
}));

router.get('/jobs/:id', h(async (req, res) => {
  const job = await prisma.job.findFirst({
    where: { id: req.params.id, status: 'OPEN' },
    include: { company: true, skills: { include: { skill: true } } },
  });
  if (!job) throw new HttpError(404, 'This job is not available.');
  res.json({ job });
}));

router.get('/gd-topics', h(async (req, res) => {
  const topics = await prisma.gDTopic.findMany({ where: { isActive: true }, orderBy: { title: 'asc' } });
  res.json({ topics });
}));

module.exports = router;
