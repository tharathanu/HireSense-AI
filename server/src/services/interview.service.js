// Voice interview: question generation and answer scoring
const { clamp, keywords, wordCount, mentions } = require('../utils/text');
const { askJson } = require('../lib/ai');

const QUESTION_COUNT = 5;
const FILLERS = ['um', 'uh', 'erm', 'like', 'you know', 'basically', 'actually', 'kind of', 'sort of'];
const HEDGES = ["i think", 'maybe', 'not sure', 'i guess', 'probably', "i don't know", 'i dont know'];

// Rule-based questions built from the job and the candidate's own resume
function templateQuestions(job, skills, parsed) {
  const required = skills.filter((s) => s.isRequired).map((s) => s.name);
  const known = (parsed?.skills || []).filter((s) => required.includes(s));
  const focus = (known.length ? known : required).slice(0, 2);
  const project = parsed?.projectTitles?.[0];

  const questions = [
    {
      focusArea: 'Introduction',
      question: `Please introduce yourself and explain why you are interested in the ${job.title} role.`,
      expectedPoints: ['background', 'skills', 'interest', 'role', 'experience'],
    },
  ];
  for (const skill of focus) {
    questions.push({
      focusArea: skill,
      question: `Explain how you have used ${skill} in your work. What problem did it solve, and what was the hardest part?`,
      expectedPoints: [skill, 'problem', 'solution', 'challenge', 'result'],
    });
  }
  questions.push({
    focusArea: 'Project',
    question: project
      ? `Walk me through your project "${project}". What was your role and what would you improve?`
      : 'Describe a project you are proud of. What was your role and what would you improve?',
    expectedPoints: ['role', 'design', 'technology', 'challenge', 'improve'],
  });
  questions.push({
    focusArea: 'Teamwork',
    question: 'Tell me about a time you disagreed with a teammate. How did you handle it and what was the outcome?',
    expectedPoints: ['situation', 'listen', 'communicate', 'compromise', 'outcome'],
  });
  while (questions.length < QUESTION_COUNT) {
    questions.push({
      focusArea: 'Problem solving',
      question: 'How do you approach debugging a problem you have never seen before?',
      expectedPoints: ['reproduce', 'logs', 'isolate', 'test', 'fix'],
    });
  }
  return questions.slice(0, QUESTION_COUNT);
}

async function generateQuestions(job, skills, parsed, resumeText) {
  const ai = await askJson(
    'You are a technical interviewer. Ask clear spoken questions; one idea per question.',
    `Create ${QUESTION_COUNT} interview questions for a ${job.title} candidate.
Job description: ${job.description.slice(0, 2000)}
Required skills: ${skills.filter((s) => s.isRequired).map((s) => s.name).join(', ')}
Candidate resume: ${(resumeText || '').slice(0, 5000)}
Mix: 1 introduction, 2 technical on required skills, 1 about their own project, 1 behavioural.
Return JSON {"questions":[{"question":"...","focusArea":"...","expectedPoints":["3-5 short key points a strong answer covers"]}]}`
  );
  if (ai && Array.isArray(ai.questions) && ai.questions.length >= 3) {
    return ai.questions.slice(0, QUESTION_COUNT).map((q) => ({
      question: String(q.question),
      focusArea: q.focusArea ? String(q.focusArea) : null,
      expectedPoints: Array.isArray(q.expectedPoints) ? q.expectedPoints.map(String).slice(0, 6) : [],
    }));
  }
  return templateQuestions(job, skills, parsed);
}

function countPhrases(text, phrases) {
  const lower = ` ${text.toLowerCase()} `;
  return phrases.reduce((sum, ph) => sum + (lower.split(` ${ph} `).length - 1), 0);
}

// Scores one spoken answer
function scoreAnswer(question, transcript, durationSec) {
  const words = wordCount(transcript);
  if (words < 5) {
    return { technicalScore: 0, communicationScore: 0, confidenceScore: 0, feedback: 'No clear answer was recorded for this question.' };
  }

  // Technical: how many expected points the answer covers
  const answerWords = new Set(keywords(transcript));
  const points = question.expectedPoints || [];
  const covered = points.filter((pt) => mentions(transcript, pt) || keywords(pt).some((w) => answerWords.has(w)));
  const coverage = points.length ? covered.length / points.length : 0.5;
  const depth = Math.min(words / 120, 1); // reward fuller answers up to ~120 words
  const technical = clamp(coverage * 75 + depth * 25);

  // Communication: length in a sensible range, few filler words
  const fillerRate = countPhrases(transcript, FILLERS) / words;
  let lengthScore = 100;
  if (words < 40) lengthScore = (words / 40) * 100;
  else if (words > 260) lengthScore = Math.max(50, 100 - (words - 260) / 4);
  const communication = clamp(lengthScore * 0.7 + Math.max(0, 100 - fillerRate * 800) * 0.3);

  // Confidence: steady pace and few hedges
  const minutes = Math.max((durationSec || 0) / 60, 0.1);
  const wpm = words / minutes;
  const paceScore = wpm >= 90 && wpm <= 180 ? 100 : wpm < 90 ? (wpm / 90) * 100 : Math.max(40, 100 - (wpm - 180));
  const hedgeRate = countPhrases(transcript, HEDGES) / words;
  const confidence = clamp(paceScore * 0.6 + Math.max(0, 100 - hedgeRate * 1000) * 0.4);

  const missing = points.filter((p) => !covered.includes(p));
  const feedback = [
    covered.length ? `Covered: ${covered.join(', ')}.` : 'The answer did not address the key points.',
    missing.length ? `Could also mention: ${missing.join(', ')}.` : 'All key points were covered.',
    fillerRate > 0.05 ? 'Try to reduce filler words.' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return { technicalScore: technical, communicationScore: communication, confidenceScore: confidence, feedback };
}

async function scoreAnswerWithAI(question, transcript, durationSec) {
  const base = scoreAnswer(question, transcript, durationSec);
  if (wordCount(transcript) < 5) return base;

  const ai = await askJson(
    'You are a fair interviewer scoring a spoken answer transcript. Ignore minor speech-to-text errors.',
    `Question: ${question.question}
Key points of a strong answer: ${(question.expectedPoints || []).join('; ')}
Answer transcript: ${transcript.slice(0, 4000)}
Return JSON {"technical":0-100,"feedback":"2 short sentences of specific advice"}`
  );
  if (ai && typeof ai.technical === 'number') {
    base.technicalScore = clamp((base.technicalScore + clamp(ai.technical) * 2) / 3);
    if (typeof ai.feedback === 'string') base.feedback = ai.feedback;
  }
  return base;
}

function overallInterviewScore(answers) {
  const scored = answers.filter((a) => a.technicalScore !== null && a.technicalScore !== undefined);
  if (!scored.length) return 0;
  const total = scored.reduce(
    (sum, a) => sum + a.technicalScore * 0.5 + a.communicationScore * 0.3 + a.confidenceScore * 0.2,
    0
  );
  return clamp(total / scored.length);
}

module.exports = {
  QUESTION_COUNT,
  templateQuestions,
  generateQuestions,
  scoreAnswer,
  scoreAnswerWithAI,
  overallInterviewScore,
};
