// API flow tests for every module. Each database call is checked against
// the real Prisma schema by the mock, so wrong field names fail the test.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
delete process.env.GEMINI_API_KEY;
delete process.env.GROQ_API_KEY;

jest.mock('../src/lib/prisma', () => require('./helpers/prismaMock').createPrismaMock());

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { signToken } = require('../src/utils/tokens');

const USERS = {
  cand: { id: 'u_cand', role: 'CANDIDATE', email: 'meera.iyer.dev@gmail.com', fullName: 'Meera Iyer', isActive: true },
  rec: { id: 'u_rec', role: 'RECRUITER', email: 'hr@northwind.in', fullName: 'Ravi Menon', isActive: true },
  admin: { id: 'u_admin', role: 'ADMIN', email: 'admin@hiresense.app', fullName: 'Admin', isActive: true },
};
const auth = (who) => ({ Authorization: `Bearer ${signToken(USERS[who])}` });

const candProfile = { id: 'cp1', userId: 'u_cand', githubUrl: null, linkedinUrl: null, phone: null };
const recProfile = { id: 'rp1', userId: 'u_rec', companyId: 'co1' };
const job = {
  id: 'job1', title: 'Full Stack Developer', status: 'OPEN', closesAt: null, blindScreening: false,
  description: 'Build React frontends and Node.js APIs with PostgreSQL.', recruiterId: 'rp1',
  recruiter: { userId: 'u_rec' },
  skills: [
    { isRequired: true, skill: { name: 'React' } },
    { isRequired: true, skill: { name: 'Node.js' } },
    { isRequired: false, skill: { name: 'Docker' } },
  ],
};

beforeEach(() => {
  prisma.__reset();
  prisma.user.findUnique.mockImplementation(async ({ where }) => Object.values(USERS).find((u) => u.id === where.id) || null);
  prisma.candidateProfile.findUnique.mockResolvedValue(candProfile);
  prisma.recruiterProfile.findUnique.mockResolvedValue(recProfile);
});

describe('Access control', () => {
  it('blocks candidates from recruiter and admin routes', async () => {
    expect((await request(app).get('/api/recruiter/jobs').set(auth('cand'))).status).toBe(403);
    expect((await request(app).get('/api/admin/users').set(auth('cand'))).status).toBe(403);
  });
  it('blocks recruiters from candidate routes', async () => {
    expect((await request(app).get('/api/candidate/applications').set(auth('rec'))).status).toBe(403);
  });
});

describe('Public jobs', () => {
  it('lists open jobs with search', async () => {
    prisma.job.findMany.mockResolvedValue([job]);
    const res = await request(app).get('/api/public/jobs?q=react');
    expect(res.status).toBe(200);
    expect(res.body.jobs).toHaveLength(1);
  });
  it('lists skills and GD topics', async () => {
    expect((await request(app).get('/api/public/skills')).status).toBe(200);
    expect((await request(app).get('/api/public/gd-topics')).status).toBe(200);
  });
});

describe('Candidate: profile and resume', () => {
  it('updates the profile and validates links', async () => {
    prisma.candidateProfile.update.mockResolvedValue(candProfile);
    const ok = await request(app).put('/api/candidate/profile').set(auth('cand')).send({
      fullName: 'Meera Iyer', college: 'Anna University', graduationYear: 2026, githubUrl: 'https://github.com/octocat',
    });
    expect(ok.status).toBe(200);
    const bad = await request(app).put('/api/candidate/profile').set(auth('cand')).send({ fullName: 'Meera Iyer', githubUrl: 'not a link' });
    expect(bad.status).toBe(400);
    expect(bad.body.fields.githubUrl).toBeTruthy();
  });

  it('uploads a real PDF, extracts skills and runs authenticity checks', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ public_repos: 8 }) }));
    prisma.skill.findMany.mockResolvedValue(
      ['React', 'Node.js', 'PostgreSQL', 'Docker', 'Go'].map((name, i) => ({ id: `s${i}`, name }))
    );
    prisma.resume.create.mockImplementation(async ({ data }) => ({ id: 'res1', ...data }));
    prisma.resume.findUnique.mockResolvedValue({ id: 'res1', authenticityChecks: [] });

    const res = await request(app)
      .post('/api/candidate/resumes')
      .set(auth('cand'))
      .attach('file', fs.readFileSync(path.join(__dirname, 'fixtures/strong-resume.pdf')), {
        filename: 'meera.pdf',
        contentType: 'application/pdf',
      });
    expect(res.status).toBe(201);

    const created = prisma.resume.create.mock.calls[0][0].data;
    expect(created.parsedData.skills).toEqual(['React', 'Node.js', 'PostgreSQL', 'Docker']);
    const skillRows = prisma.candidateSkill.createMany.mock.calls[0][0].data;
    expect(skillRows).toHaveLength(4);
    const checks = prisma.authenticityCheck.createMany.mock.calls[0][0].data;
    expect(checks.map((c) => c.checkType)).toEqual(['GITHUB_PROFILE', 'LINKEDIN_URL', 'SKILL_EVIDENCE']);
    expect(checks[0].result).toBe('VERIFIED');
    // Empty profile links are filled from the resume
    expect(prisma.candidateProfile.update.mock.calls[0][0].data.githubUrl).toBe('https://github.com/octocat');
    delete global.fetch;
  });

  it('rejects other file types', async () => {
    const res = await request(app).post('/api/candidate/resumes').set(auth('cand'))
      .attach('file', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
  });
});

describe('Candidate: applying', () => {
  it('applies with the primary resume and stores the job match', async () => {
    prisma.job.findUnique.mockResolvedValue(job);
    prisma.resume.findFirst.mockResolvedValue({
      id: 'res1', extractedText: 'React Node.js', parsedData: { skills: ['React', 'Node.js'], projects: 'x', experience: 'y' },
    });
    prisma.application.findUnique.mockResolvedValue(null);
    prisma.application.create.mockResolvedValue({ id: 'app1', jobId: 'job1' });

    const res = await request(app).post('/api/candidate/applications').set(auth('cand')).send({ jobId: 'job1' });
    expect(res.status).toBe(201);
    const analysis = prisma.resumeAnalysis.create.mock.calls[0][0].data;
    expect(analysis.skillCoverage).toBe(100);
    expect(prisma.notification.create).toHaveBeenCalled(); // recruiter told about the new applicant
  });

  it('requires a resume and refuses duplicates or closed jobs', async () => {
    prisma.job.findUnique.mockResolvedValue(job);
    prisma.resume.findFirst.mockResolvedValue(null);
    expect((await request(app).post('/api/candidate/applications').set(auth('cand')).send({ jobId: 'job1' })).status).toBe(400);

    prisma.resume.findFirst.mockResolvedValue({ id: 'res1', parsedData: {} });
    prisma.application.findUnique.mockResolvedValue({ id: 'app1' });
    expect((await request(app).post('/api/candidate/applications').set(auth('cand')).send({ jobId: 'job1' })).status).toBe(409);

    prisma.job.findUnique.mockResolvedValue({ ...job, status: 'CLOSED' });
    expect((await request(app).post('/api/candidate/applications').set(auth('cand')).send({ jobId: 'job1' })).status).toBe(404);
  });

  it('lists applications with every stage', async () => {
    prisma.application.findMany.mockResolvedValue([{ id: 'app1' }]);
    const res = await request(app).get('/api/candidate/applications').set(auth('cand'));
    expect(res.status).toBe(200);
  });
});

describe('Candidate: aptitude test', () => {
  const attempt = { id: 'att1', status: 'NOT_STARTED', durationMinutes: 30, questionCount: 15, startedAt: null };
  const appAt = (a) => ({ id: 'app1', jobId: 'job1', stage: 'APTITUDE', status: 'SHORTLISTED', job, aptitudeAttempt: a });

  it('starts the test', async () => {
    prisma.application.findFirst.mockResolvedValue(appAt(attempt));
    prisma.aptitudeQuestion.count.mockResolvedValue(48);
    prisma.aptitudeAttempt.update.mockImplementation(async ({ data }) => ({ ...attempt, ...data }));
    const res = await request(app).post('/api/candidate/aptitude/app1/start').set(auth('cand'));
    expect(res.status).toBe(200);
    expect(res.body.attempt.secondsLeft).toBeGreaterThan(1790);
  });

  it('refuses to start when the candidate is not in the aptitude stage', async () => {
    prisma.application.findFirst.mockResolvedValue({ ...appAt(attempt), stage: 'SCREENING' });
    expect((await request(app).post('/api/candidate/aptitude/app1/start').set(auth('cand'))).status).toBe(403);
  });

  it('serves an adaptive question without revealing the answer', async () => {
    const live = { ...attempt, status: 'IN_PROGRESS', startedAt: new Date() };
    prisma.application.findFirst.mockResolvedValue(appAt(live));
    prisma.aptitudeAnswer.findMany.mockResolvedValue([]);
    prisma.aptitudeQuestion.findMany.mockResolvedValue([{ id: 'q1', category: 'QUANTITATIVE', difficulty: 'MEDIUM' }]);
    prisma.aptitudeAnswer.create.mockResolvedValue({
      id: 'ans1', orderIndex: 0,
      question: { category: 'QUANTITATIVE', difficulty: 'MEDIUM', question: 'What is 15% of 240?', options: ['32', '36'], correctIndex: 1 },
    });
    const res = await request(app).get('/api/candidate/aptitude/app1/question').set(auth('cand'));
    expect(res.status).toBe(200);
    expect(res.body.question.text).toBe('What is 15% of 240?');
    expect(JSON.stringify(res.body)).not.toMatch(/correctIndex/);
  });

  it('marks answers and finishes after the last question', async () => {
    const live = { ...attempt, status: 'IN_PROGRESS', startedAt: new Date(), questionCount: 1 };
    prisma.application.findFirst.mockResolvedValue(appAt(live));
    prisma.aptitudeAnswer.findFirst.mockResolvedValue({ id: 'ans1', isCorrect: null, question: { options: ['32', '36'], correctIndex: 1 } });
    prisma.aptitudeAnswer.count.mockResolvedValue(1);
    prisma.aptitudeAnswer.findMany.mockResolvedValue([{ isCorrect: true, question: { category: 'QUANTITATIVE', difficulty: 'MEDIUM' } }]);
    prisma.aptitudeAttempt.update.mockImplementation(async ({ data }) => ({ ...live, ...data }));

    const res = await request(app).post('/api/candidate/aptitude/app1/answer').set(auth('cand')).send({ answerId: 'ans1', selectedIndex: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ done: true, score: 100 });
    expect(prisma.aptitudeAnswer.update.mock.calls[0][0].data.isCorrect).toBe(true);
  });

  it('auto-submits after three tab switches', async () => {
    const live = { ...attempt, status: 'IN_PROGRESS', startedAt: new Date() };
    prisma.application.findFirst.mockResolvedValue(appAt(live));
    prisma.aptitudeAttempt.update.mockResolvedValueOnce({ ...live, tabSwitchCount: 3 }).mockResolvedValueOnce({});
    const res = await request(app).post('/api/integrity').set(auth('cand'))
      .send({ applicationId: 'app1', stage: 'APTITUDE', type: 'TAB_SWITCH' });
    expect(res.body.autoSubmitted).toBe(true);
    expect(prisma.integrityLog.create).toHaveBeenCalled();
  });
});

describe('Candidate: voice interview', () => {
  const session = (over = {}) => ({ id: 'iv1', status: 'SCHEDULED', startedAt: null, questions: [], ...over });
  const appIv = (s) => ({
    id: 'app1', jobId: 'job1', stage: 'INTERVIEW', status: 'SHORTLISTED', job,
    resume: { parsedData: { skills: ['React'], projectTitles: ['TaskFlow'] }, extractedText: 'x' },
    interviewSession: s,
  });

  it('generates 5 questions and starts the interview', async () => {
    prisma.application.findFirst.mockResolvedValueOnce(appIv(session()))
      .mockResolvedValueOnce(appIv(session({ status: 'LIVE', questions: [{ id: 'q1', orderIndex: 0, question: 'Intro', answer: null }] })));
    prisma.job.findUnique.mockResolvedValue({ ...job, skills: job.skills });
    const res = await request(app).post('/api/candidate/interview/app1/start').set(auth('cand'));
    expect(res.status).toBe(200);
    expect(prisma.interviewQuestion.createMany.mock.calls[0][0].data).toHaveLength(5);
    expect(res.body.session.status).toBe('LIVE');
  });

  it('scores a spoken answer and completes the interview', async () => {
    const q = { id: 'q1', question: 'Explain React', expectedPoints: ['React', 'state', 'components'], answer: null };
    prisma.application.findFirst.mockResolvedValue(appIv(session({ status: 'LIVE', questions: [q] })));
    const res = await request(app).post('/api/candidate/interview/app1/answer').set(auth('cand'))
      .send({ questionId: 'q1', transcript: 'React builds interfaces from reusable components that manage their own state and props.', durationSec: 12 });
    expect(res.status).toBe(200);
    const saved = prisma.interviewAnswer.create.mock.calls[0][0].data;
    expect(saved.technicalScore).toBeGreaterThan(50);

    prisma.application.findFirst.mockResolvedValue(appIv(session({
      status: 'LIVE', questions: [{ ...q, answer: { technicalScore: 80, communicationScore: 70, confidenceScore: 60 } }],
    })));
    const done = await request(app).post('/api/candidate/interview/app1/finish').set(auth('cand'));
    expect(done.status).toBe(200);
    expect(prisma.interviewSession.update.mock.calls.pop()[0].data.overallScore).toBe(73);
  });
});

describe('Recruiter: jobs', () => {
  const body = {
    title: 'Full Stack Developer',
    description: 'Build and maintain React and Node.js features for our hiring products.',
    requiredSkillIds: ['s1', 's2'],
    optionalSkillIds: ['s2', 's3'],
    blindScreening: true,
    status: 'OPEN',
  };

  it('creates a job with required and optional skills', async () => {
    prisma.job.create.mockResolvedValue({ id: 'job1' });
    const res = await request(app).post('/api/recruiter/jobs').set(auth('rec')).send(body);
    expect(res.status).toBe(201);
    const rows = prisma.job.create.mock.calls[0][0].data.skills.create;
    expect(rows).toEqual([
      { skillId: 's1', isRequired: true },
      { skillId: 's2', isRequired: true },
      { skillId: 's3', isRequired: false },
    ]);
  });

  it('validates job fields', async () => {
    const res = await request(app).post('/api/recruiter/jobs').set(auth('rec')).send({ title: 'X', description: 'short', requiredSkillIds: [] });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields)).toEqual(expect.arrayContaining(['title', 'description', 'requiredSkillIds']));
  });

  it('only lets a recruiter edit their own jobs', async () => {
    prisma.job.findFirst.mockResolvedValue(null);
    expect((await request(app).put('/api/recruiter/jobs/other').set(auth('rec')).send(body)).status).toBe(404);
  });
});

describe('Recruiter: pipeline', () => {
  const application = {
    id: 'clapp00001', jobId: 'job1', stage: 'SCREENING', status: 'IN_PROGRESS', candidateId: 'cp1',
    job: { ...job, blindScreening: true },
    candidate: { id: 'cp1', user: { fullName: 'Meera Iyer', email: 'meera@gmail.com' }, college: 'Anna University' },
  };

  it('hides names in blind screening', async () => {
    prisma.job.findFirst.mockResolvedValue({ ...job, blindScreening: true });
    prisma.application.findMany.mockResolvedValue([application]);
    const res = await request(app).get('/api/recruiter/jobs/job1/applications').set(auth('rec'));
    expect(res.status).toBe(200);
    expect(res.body.applications[0].candidate.user.fullName).toBe('Candidate 00001');
    expect(JSON.stringify(res.body)).not.toMatch(/Meera|Anna University/);
  });

  it('advances a candidate to the aptitude test and notifies them', async () => {
    prisma.application.findFirst.mockResolvedValue(application);
    prisma.application.update.mockResolvedValue({ ...application, stage: 'APTITUDE' });
    const res = await request(app).post('/api/recruiter/applications/clapp00001/advance').set(auth('rec'));
    expect(res.status).toBe(200);
    expect(prisma.aptitudeAttempt.upsert).toHaveBeenCalled();
    expect(prisma.stageHistory.create.mock.calls[0][0].data.toStage).toBe('APTITUDE');
    expect(prisma.notification.create.mock.calls[0][0].data.userId).toBe('u_cand');
  });

  it('builds the final report when reaching final review', async () => {
    prisma.application.findFirst.mockResolvedValue({ ...application, stage: 'INTERVIEW', status: 'SHORTLISTED' });
    prisma.application.findUnique.mockResolvedValue({
      ...application, resumeAnalysis: { fitScore: 80, missingSkills: [] }, aptitudeAttempt: { score: 70 },
      gdParticipant: { impactScore: 75 }, interviewSession: { overallScore: 72, questions: [] }, integrityLogs: [],
    });
    const res = await request(app).post('/api/recruiter/applications/clapp00001/advance').set(auth('rec'));
    expect(res.status).toBe(200);
    const report = prisma.finalReport.upsert.mock.calls[0][0].create;
    expect(report.overallScore).toBe(77);
    expect(report.recommendation).toBe('HIRE');
  });

  it('rejects with a released feedback report', async () => {
    prisma.application.findFirst.mockResolvedValue(application);
    prisma.application.findUnique.mockResolvedValue({ ...application, resumeAnalysis: { fitScore: 30, matchedSkills: [], missingSkills: ['React'] }, integrityLogs: [] });
    const res = await request(app).post('/api/recruiter/applications/clapp00001/reject').set(auth('rec')).send({});
    expect(res.status).toBe(200);
    const fb = prisma.candidateFeedback.upsert.mock.calls[0][0];
    expect(fb.create.isReleased).toBe(true);
    expect(fb.create.areasToImprove.join(' ')).toMatch(/React/);
  });

  it('only hires from final review', async () => {
    prisma.application.findFirst.mockResolvedValue(application);
    expect((await request(app).post('/api/recruiter/applications/clapp00001/hire').set(auth('rec')).send({})).status).toBe(400);
  });

  it('returns the full candidate view', async () => {
    prisma.application.findFirst.mockResolvedValue({ ...application, stage: 'APTITUDE', resume: { id: 'r', authenticityChecks: [] } });
    const res = await request(app).get('/api/recruiter/applications/clapp00001').set(auth('rec'));
    expect(res.status).toBe(200);
    expect(res.body.application.candidate.user.fullName).toBe('Meera Iyer');
  });

  it('ranks candidates by final score', async () => {
    prisma.job.findFirst.mockResolvedValue(job);
    prisma.application.findMany.mockResolvedValue([
      { id: 'a1', stage: 'FINAL_REVIEW', finalReport: { overallScore: 60 }, candidate: { user: { fullName: 'A' } } },
      { id: 'a2', stage: 'FINAL_REVIEW', finalReport: { overallScore: 85 }, candidate: { user: { fullName: 'B' } } },
    ]);
    const res = await request(app).get('/api/recruiter/jobs/job1/ranking').set(auth('rec'));
    expect(res.body.ranking.map((r) => r.id)).toEqual(['a2', 'a1']);
  });
});

describe('Recruiter: group discussion and scheduling', () => {
  it('creates a GD session only for candidates in the GD stage', async () => {
    prisma.job.findFirst.mockResolvedValue(job);
    prisma.gDTopic.findFirst.mockResolvedValue({ id: 't1', title: 'AI and jobs' });
    prisma.application.findMany.mockResolvedValue([
      { id: 'a1', gdParticipant: null, candidate: { userId: 'u1' } },
      { id: 'a2', gdParticipant: null, candidate: { userId: 'u2' } },
    ]);
    prisma.gDSession.create.mockResolvedValue({ id: 'gd1' });
    const res = await request(app).post('/api/recruiter/gd').set(auth('rec')).send({
      jobId: 'job1', topicId: 't1', scheduledAt: '2026-12-01T10:00:00.000Z', applicationIds: ['a1', 'a2'],
    });
    expect(res.status).toBe(201);
    expect(prisma.scheduledEvent.create).toHaveBeenCalledTimes(2);

    prisma.application.findMany.mockResolvedValue([{ id: 'a1', gdParticipant: null, candidate: { userId: 'u1' } }]);
    const bad = await request(app).post('/api/recruiter/gd').set(auth('rec')).send({
      jobId: 'job1', topicId: 't1', scheduledAt: '2026-12-01T10:00:00.000Z', applicationIds: ['a1', 'a2'],
    });
    expect(bad.status).toBe(400);
  });

  it('scores everyone when the discussion ends', async () => {
    prisma.gDSession.findFirst.mockResolvedValue({
      id: 'gd1', status: 'LIVE', topic: { title: 'Remote work for freshers', description: 'learning mentorship' },
      participants: [
        { id: 'p1', entries: [{ text: 'Remote work limits mentorship for freshers.', spokenAt: new Date() }] },
        { id: 'p2', entries: [] },
      ],
    });
    const res = await request(app).post('/api/recruiter/gd/gd1/end').set(auth('rec'));
    expect(res.status).toBe(200);
    expect(prisma.gDParticipant.update).toHaveBeenCalledTimes(2);
    expect(res.body.results.find((r) => r.participantId === 'p2').impactScore).toBe(0);
  });

  it('schedules an interview slot and emails the candidate', async () => {
    prisma.application.findMany.mockResolvedValue([{ id: 'a1', jobId: 'job1', job, candidate: { userId: 'u_cand' } }]);
    const res = await request(app).post('/api/recruiter/events').set(auth('rec')).send({
      applicationIds: ['a1'], type: 'INTERVIEW', startsAt: '2026-12-02T10:00:00.000Z', endsAt: '2026-12-02T18:00:00.000Z',
    });
    expect(res.status).toBe(201);
    expect(prisma.emailLog.create).toHaveBeenCalled(); // logged as SKIPPED without SMTP
  });

  it('rejects an end time before the start', async () => {
    const res = await request(app).post('/api/recruiter/events').set(auth('rec')).send({
      applicationIds: ['a1'], type: 'INTERVIEW', startsAt: '2026-12-02T10:00:00.000Z', endsAt: '2026-12-02T09:00:00.000Z',
    });
    expect(res.status).toBe(400);
  });
});

describe('GD room access', () => {
  const session = {
    id: 'gd1', status: 'SCHEDULED', topic: { title: 'T', description: 'D' },
    job: { title: 'FSD', blindScreening: false, recruiter: { userId: 'u_rec' } },
    participants: [{ id: 'p1', applicationId: 'a1', application: { candidate: { user: { id: 'u_cand', fullName: 'Meera Iyer' } } } }],
  };
  it('lets the participant and host in, and nobody else', async () => {
    prisma.gDSession.findUnique.mockResolvedValue(session);
    expect((await request(app).get('/api/gd/gd1').set(auth('cand'))).body.role).toBe('PARTICIPANT');
    expect((await request(app).get('/api/gd/gd1').set(auth('rec'))).body.role).toBe('HOST');
    expect((await request(app).get('/api/gd/gd1').set(auth('admin'))).status).toBe(403);
  });
});

describe('Notifications', () => {
  it('lists and marks notifications as read', async () => {
    prisma.notification.findMany.mockResolvedValue([{ id: 'n1', isRead: false }, { id: 'n2', isRead: true }]);
    const res = await request(app).get('/api/notifications').set(auth('cand'));
    expect(res.body.unread).toBe(1);
    expect((await request(app).post('/api/notifications/read-all').set(auth('cand'))).status).toBe(200);
  });
});

describe('Admin', () => {
  it('lists users and blocks self-deactivation', async () => {
    expect((await request(app).get('/api/admin/users?role=RECRUITER&q=ravi').set(auth('admin'))).status).toBe(200);
    expect((await request(app).patch('/api/admin/users/u_admin').set(auth('admin')).send({ isActive: false })).status).toBe(400);
    prisma.user.update.mockResolvedValue({ id: 'u_cand', isActive: false });
    expect((await request(app).patch('/api/admin/users/u_cand').set(auth('admin')).send({ isActive: false })).status).toBe(200);
  });

  it('validates questions in the question bank', async () => {
    const bad = await request(app).post('/api/admin/questions').set(auth('admin')).send({
      category: 'LOGICAL', difficulty: 'EASY', question: 'Which is next: 2, 4, 6?', options: ['7', '8'], correctIndex: 5,
    });
    expect(bad.status).toBe(400);
    prisma.aptitudeQuestion.create.mockResolvedValue({ id: 'q1' });
    const ok = await request(app).post('/api/admin/questions').set(auth('admin')).send({
      category: 'LOGICAL', difficulty: 'EASY', question: 'Which is next: 2, 4, 6?', options: ['7', '8'], correctIndex: 1,
    });
    expect(ok.status).toBe(201);
  });

  it('deactivates a used question instead of deleting it', async () => {
    prisma.aptitudeAnswer.count.mockResolvedValue(3);
    const res = await request(app).delete('/api/admin/questions/q1').set(auth('admin'));
    expect(res.body.deactivated).toBe(true);
    expect(prisma.aptitudeQuestion.delete).not.toHaveBeenCalled();
  });

  it('manages GD topics and shows stats', async () => {
    prisma.gDTopic.create.mockResolvedValue({ id: 't1' });
    expect((await request(app).post('/api/admin/topics').set(auth('admin')).send({ title: 'Is remote work here to stay?' })).status).toBe(201);
    expect((await request(app).get('/api/dashboard/admin').set(auth('admin'))).status).toBe(200);
  });
});

describe('Dashboards', () => {
  it('returns real counts for candidate and recruiter', async () => {
    expect((await request(app).get('/api/dashboard/candidate').set(auth('cand'))).status).toBe(200);
    prisma.application.groupBy.mockResolvedValue([{ stage: 'APTITUDE', _count: { _all: 3 } }]);
    const rec = await request(app).get('/api/dashboard/recruiter').set(auth('rec'));
    expect(rec.body.pipeline.APTITUDE).toBe(3);
  });
});
