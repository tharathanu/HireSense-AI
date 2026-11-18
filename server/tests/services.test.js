// Unit tests for scoring and parsing logic (no database needed)
process.env.NODE_ENV = 'test';
delete process.env.GEMINI_API_KEY;
delete process.env.GROQ_API_KEY;

jest.mock('../src/lib/prisma', () => require('./helpers/prismaMock').createPrismaMock());

const fs = require('fs');
const path = require('path');
const resume = require('../src/services/resume.service');
const { ruleBasedMatch } = require('../src/services/match.service');
const authenticity = require('../src/services/authenticity.service');
const aptitude = require('../src/services/aptitude.service');
const gd = require('../src/services/gd.service');
const interview = require('../src/services/interview.service');
const report = require('../src/services/report.service');
const { maskCandidate } = require('../src/utils/blind');
const ai = require('../src/lib/ai');

const SKILLS = ['JavaScript', 'Python', 'SQL', 'React', 'HTML', 'CSS', 'Node.js', 'Express.js', 'PostgreSQL', 'MongoDB', 'Git', 'Docker', 'Java', 'C', 'Go'];
const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name));

describe('Resume parsing', () => {
  it('reads a real PDF resume and finds sections, links and skills', async () => {
    const text = await resume.extractText(fixture('strong-resume.pdf'), resume.PDF);
    const parsed = await resume.parseResume(text, SKILLS);
    expect(parsed.name).toBe('Meera Iyer');
    expect(parsed.githubUsername).toBe('octocat');
    expect(parsed.linkedinUrl).toBe('https://www.linkedin.com/in/meera-iyer-dev');
    expect(parsed.email).toBe('meera.iyer.dev@gmail.com');
    expect(parsed.skills).toEqual(expect.arrayContaining(['React', 'Node.js', 'PostgreSQL', 'Docker']));
    expect(parsed.skills).not.toContain('Go');
    expect(parsed.skills).not.toContain('C');
    expect(parsed.projectTitles).toEqual(['TaskFlow', 'BookNest']);
    expect(parsed.experience).toMatch(/Brightlane/);
    expect(parsed.aiEnhanced).toBe(false);
  });

  it('reads a real DOCX resume', async () => {
    const text = await resume.extractText(fixture('strong-resume.docx'), resume.DOCX);
    expect(text).toMatch(/Meera Iyer/);
  });

  it('rejects unsupported and unreadable files', async () => {
    await expect(resume.extractText(Buffer.from('hello'), 'text/plain')).rejects.toMatchObject({ status: 400 });
    await expect(resume.extractText(Buffer.from('not a pdf'), resume.PDF)).rejects.toMatchObject({ status: 400 });
  });
});

describe('Job match', () => {
  const job = { title: 'Full Stack Developer', description: 'Build React frontends and Node.js REST APIs with PostgreSQL databases.' };
  const skills = [
    { name: 'React', isRequired: true },
    { name: 'Node.js', isRequired: true },
    { name: 'PostgreSQL', isRequired: true },
    { name: 'TypeScript', isRequired: true },
    { name: 'Docker', isRequired: false },
  ];

  it('scores coverage of required skills and lists what is missing', () => {
    const parsed = { skills: ['React', 'Node.js', 'PostgreSQL', 'Docker'], projects: 'React app', experience: 'Intern' };
    const m = ruleBasedMatch(parsed, job, skills);
    expect(m.skillCoverage).toBe(75);
    expect(m.missingSkills).toEqual(['TypeScript']);
    expect(m.matchedSkills).toEqual(expect.arrayContaining(['React', 'Docker']));
    expect(m.fitScore).toBeGreaterThan(50);
  });

  it('gives a weak resume a clearly lower score', () => {
    const strong = ruleBasedMatch({ skills: ['React', 'Node.js', 'PostgreSQL', 'TypeScript'], projects: 'x', experience: 'y' }, job, skills);
    const weak = ruleBasedMatch({ skills: ['Java'], projects: '', experience: '' }, job, skills);
    expect(weak.fitScore).toBeLessThan(strong.fitScore - 40);
    expect(weak.gaps.length).toBeGreaterThan(0);
  });
});

describe('Resume authenticity', () => {
  afterEach(() => { delete global.fetch; });

  it('validates LinkedIn link format', () => {
    expect(authenticity.checkLinkedin('https://www.linkedin.com/in/meera-iyer-dev').result).toBe('VERIFIED');
    expect(authenticity.checkLinkedin(null).result).toBe('UNVERIFIED');
  });

  it('flags skills that no project or experience supports', () => {
    const [check] = authenticity.checkSkillEvidence({
      skills: ['React', 'Kubernetes', 'Go', 'Rust'],
      projects: 'Built a React dashboard',
      experience: '',
    });
    expect(check.result).toBe('FLAGGED');
    expect(check.detail).toMatch(/Kubernetes/);
  });

  it('verifies a GitHub profile with public repositories', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ public_repos: 12 }) }));
    const r = await authenticity.checkGithub('octocat');
    expect(r.result).toBe('VERIFIED');
    expect(r.detail).toMatch(/12 public repositories/);
  });

  it('flags a GitHub profile that does not exist', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 404 }));
    expect((await authenticity.checkGithub('no-such-user-xyz')).result).toBe('FLAGGED');
  });
});

describe('Adaptive aptitude test', () => {
  const bank = [];
  for (const category of aptitude.CATEGORIES) {
    for (const difficulty of ['EASY', 'MEDIUM', 'HARD']) {
      for (let i = 0; i < 3; i += 1) bank.push({ id: `${category}-${difficulty}-${i}`, category, difficulty });
    }
  }

  it('starts at medium, goes up after a correct answer and down after a wrong one', () => {
    expect(aptitude.nextDifficulty([])).toBe('MEDIUM');
    expect(aptitude.nextDifficulty([{ isCorrect: true, question: { difficulty: 'MEDIUM' } }])).toBe('HARD');
    expect(aptitude.nextDifficulty([{ isCorrect: false, question: { difficulty: 'MEDIUM' } }])).toBe('EASY');
    expect(aptitude.nextDifficulty([{ isCorrect: true, question: { difficulty: 'HARD' } }])).toBe('HARD');
  });

  it('rotates categories and never repeats a question', () => {
    const answers = [];
    for (let i = 0; i < 15; i += 1) {
      const next = aptitude.pickNextQuestion(answers, bank);
      expect(answers.map((a) => a.questionId)).not.toContain(next.id);
      expect(next.category).toBe(aptitude.CATEGORIES[i % 4]);
      answers.push({ questionId: next.id, isCorrect: i % 2 === 0, question: next });
    }
  });

  it('weights harder questions more', () => {
    const hardRight = aptitude.scoreAttempt([
      { isCorrect: true, question: { category: 'LOGICAL', difficulty: 'HARD' } },
      { isCorrect: false, question: { category: 'LOGICAL', difficulty: 'EASY' } },
    ]);
    const easyRight = aptitude.scoreAttempt([
      { isCorrect: false, question: { category: 'LOGICAL', difficulty: 'HARD' } },
      { isCorrect: true, question: { category: 'LOGICAL', difficulty: 'EASY' } },
    ]);
    expect(hardRight.score).toBe(75);
    expect(easyRight.score).toBe(25);
    expect(hardRight.categoryScores.LOGICAL).toEqual({ correct: 1, total: 2, percent: 50 });
  });

  it('expires after the time limit', () => {
    const startedAt = new Date(Date.now() - 31 * 60 * 1000);
    expect(aptitude.isExpired({ startedAt, durationMinutes: 30 })).toBe(true);
    expect(aptitude.isExpired({ startedAt: new Date(), durationMinutes: 30 })).toBe(false);
  });
});

describe('Group discussion scoring', () => {
  const topic = { title: 'Will artificial intelligence create more jobs than it replaces?', description: 'automation reskilling industries' };
  const at = (s) => new Date(Date.UTC(2026, 0, 1, 10, 0, s));
  const participants = [
    { id: 'p1', entries: [
      { text: 'Let us start. I think artificial intelligence will create new jobs in data and automation.', spokenAt: at(1) },
      { text: 'Building on that, reskilling programs matter for every industry.', spokenAt: at(30) },
      { text: 'To summarize, jobs change rather than disappear. What do you think?', spokenAt: at(90) },
    ] },
    { id: 'p2', entries: [
      { text: 'I disagree, automation will replace many factory jobs quickly.', spokenAt: at(15) },
      { text: 'For example, industries like manufacturing already lost jobs.', spokenAt: at(60) },
    ] },
    { id: 'p3', entries: [] },
  ];

  it('rewards on-topic contributions and initiative, and scores silence as zero', () => {
    const results = gd.scoreDiscussion(participants, topic);
    const [p1, p2, p3] = results;
    expect(p1.impactScore).toBeGreaterThan(p2.impactScore);
    expect(p1.leadershipScore).toBeGreaterThan(p2.leadershipScore);
    expect(p2.relevanceScore).toBeGreaterThanOrEqual(50);
    expect(p3.impactScore).toBe(0);
    expect(p3.summary).toMatch(/did not speak/i);
  });
});

describe('Voice interview', () => {
  it('builds 5 questions from the job and resume without AI', () => {
    const qs = interview.templateQuestions(
      { title: 'Backend Developer' },
      [{ name: 'Node.js', isRequired: true }, { name: 'PostgreSQL', isRequired: true }],
      { skills: ['Node.js'], projectTitles: ['TaskFlow'] }
    );
    expect(qs).toHaveLength(5);
    expect(qs[0].question).toMatch(/Backend Developer/);
    expect(qs.some((q) => q.question.includes('TaskFlow'))).toBe(true);
    expect(qs.some((q) => q.focusArea === 'Node.js')).toBe(true);
  });

  it('scores a clear, relevant answer above a vague one', () => {
    const q = { question: 'Explain how you used Node.js', expectedPoints: ['Node.js', 'problem', 'solution', 'challenge', 'result'] };
    const good = interview.scoreAnswer(q,
      'In my internship I used Node.js with Express to build a REST API for a booking system. The problem was slow responses when many users searched at once. My solution was to add database indexes and caching. The hardest challenge was keeping the cache correct after updates, which I handled with expiry times. As a result the average response time dropped from about two seconds to under three hundred milliseconds, and the team adopted the same approach in other services.',
      45);
    const vague = interview.scoreAnswer(q, 'Um basically I think I used it, like, maybe once, you know, not sure.', 20);
    expect(good.technicalScore).toBeGreaterThan(70);
    expect(good.technicalScore).toBeGreaterThan(vague.technicalScore + 30);
    expect(good.communicationScore).toBeGreaterThan(vague.communicationScore);
    expect(good.confidenceScore).toBeGreaterThan(vague.confidenceScore);
  });

  it('gives zero for an empty answer', () => {
    expect(interview.scoreAnswer({ expectedPoints: ['x'] }, '', 10).technicalScore).toBe(0);
  });
});

describe('Final report and feedback', () => {
  const app = {
    status: 'REJECTED',
    resumeAnalysis: { fitScore: 82, matchedSkills: ['React', 'Node.js'], missingSkills: ['TypeScript'] },
    aptitudeAttempt: { score: 45, categoryScores: { VERBAL: { percent: 80 }, QUANTITATIVE: { percent: 30 } } },
    gdParticipant: { impactScore: 70, turnCount: 2, relevanceScore: 80 },
    interviewSession: { overallScore: 60, questions: [{ answer: { technicalScore: 55, communicationScore: 50 } }] },
    integrityLogs: [{ type: 'TAB_SWITCH' }, { type: 'PHONE_DETECTED' }],
  };

  it('combines all rounds with the right weights', () => {
    const r = report.buildFinalReport(app);
    // 82*.2 + 45*.2 + 70*.2 + 60*.3 + 77*.1 = 65.1
    expect(r.integrityScore).toBe(77);
    expect(r.overallScore).toBe(65);
    expect(r.recommendation).toBe('HIRE');
    expect(r.strengths[0]).toMatch(/Resume match/);
    expect(r.weaknesses.join(' ')).toMatch(/Aptitude test.*TypeScript.*integrity/);
  });

  it('re-weights when some rounds have not happened yet', () => {
    const r = report.buildFinalReport({ resumeAnalysis: { fitScore: 90, missingSkills: [] }, integrityLogs: [] });
    expect(r.aptitudeScore).toBeNull();
    expect(r.overallScore).toBe(93); // (90*.2 + 100*.1) / .3
  });

  it('writes specific, kind feedback with next steps', () => {
    const f = report.buildFeedback(app);
    expect(f.headline).toMatch(/Thank you/);
    expect(f.whatWentWell.join(' ')).toMatch(/React/);
    expect(f.areasToImprove.join(' ')).toMatch(/TypeScript/);
    expect(f.areasToImprove.join(' ')).toMatch(/quantitative/);
    expect(f.learningActions.join(' ')).toMatch(/project using TypeScript/);
  });
});

describe('Blind screening', () => {
  const application = {
    id: 'clxyzabcde12345',
    stage: 'SCREENING',
    candidate: { id: 'c1', user: { fullName: 'Meera Iyer', email: 'meera@gmail.com' }, college: 'Anna University', gender: 'Female', githubUrl: 'x' },
    resume: { id: 'r1', fileName: 'meera.pdf', extractedText: 'Meera Iyer ...', parsedData: { skills: ['React'], education: 'Anna University' } },
  };

  it('hides identity while screening a blind job', () => {
    const m = maskCandidate(application, { blindScreening: true });
    expect(m.isBlind).toBe(true);
    expect(m.candidate.user.fullName).toBe('Candidate 12345');
    expect(m.candidate.user.email).toBeNull();
    expect(m.candidate.college).toBeNull();
    expect(m.candidate.gender).toBeNull();
    expect(m.resume.extractedText).toBeNull();
    expect(m.resume.parsedData.education).toBeUndefined();
    expect(m.resume.parsedData.skills).toEqual(['React']);
  });

  it('reveals identity after screening or when the job is not blind', () => {
    expect(maskCandidate({ ...application, stage: 'APTITUDE' }, { blindScreening: true }).candidate.user.fullName).toBe('Meera Iyer');
    expect(maskCandidate(application, { blindScreening: false }).isBlind).toBe(false);
  });
});

describe('AI helper', () => {
  it('returns null when no free AI key is configured, so rule-based logic is used', async () => {
    expect(ai.isEnabled()).toBe(false);
    expect(await ai.askJson('x', 'y')).toBeNull();
  });

  it('extracts JSON from a model reply', () => {
    expect(ai.parseJson('```json\n{"fit": 80}\n```')).toEqual({ fit: 80 });
    expect(ai.parseJson('no json here')).toBeNull();
  });
});
