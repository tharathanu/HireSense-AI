// Adaptive aptitude test logic (pure functions, easy to test)
const { clamp } = require('../utils/text');

const CATEGORIES = ['QUANTITATIVE', 'LOGICAL', 'VERBAL', 'TECHNICAL'];
const LEVELS = ['EASY', 'MEDIUM', 'HARD'];
const WEIGHT = { EASY: 1, MEDIUM: 2, HARD: 3 };

// Next difficulty: start at MEDIUM, go up after a correct answer, down after a wrong one
function nextDifficulty(answers) {
  const answered = answers.filter((a) => a.isCorrect !== null && a.isCorrect !== undefined);
  if (answered.length === 0) return 'MEDIUM';
  const last = answered[answered.length - 1];
  const idx = LEVELS.indexOf(last.question.difficulty);
  if (last.isCorrect) return LEVELS[Math.min(idx + 1, 2)];
  return LEVELS[Math.max(idx - 1, 0)];
}

// Chooses the next question that has not been used yet.
// answers: [{ questionId, isCorrect, question: { difficulty, category } }]
// bank: [{ id, category, difficulty }]
function pickNextQuestion(answers, bank) {
  const used = new Set(answers.map((a) => a.questionId));
  const available = bank.filter((q) => !used.has(q.id));
  if (available.length === 0) return null;

  const category = CATEGORIES[answers.length % CATEGORIES.length];
  const difficulty = nextDifficulty(answers);
  const random = (list) => list[Math.floor(Math.random() * list.length)];

  return (
    random(available.filter((q) => q.category === category && q.difficulty === difficulty)) ||
    random(available.filter((q) => q.category === category)) ||
    random(available.filter((q) => q.difficulty === difficulty)) ||
    random(available)
  );
}

// Weighted score: harder questions count more
function scoreAttempt(answers) {
  let earned = 0;
  let possible = 0;
  const categoryScores = {};

  for (const a of answers) {
    const { category, difficulty } = a.question;
    const weight = WEIGHT[difficulty] || 1;
    possible += weight;
    if (a.isCorrect) earned += weight;

    categoryScores[category] = categoryScores[category] || { correct: 0, total: 0, percent: 0 };
    categoryScores[category].total += 1;
    if (a.isCorrect) categoryScores[category].correct += 1;
  }
  for (const c of Object.values(categoryScores)) {
    c.percent = clamp((c.correct / c.total) * 100);
  }
  return { score: possible ? clamp((earned / possible) * 100) : 0, categoryScores };
}

function isExpired(attempt, now = new Date()) {
  if (!attempt.startedAt) return false;
  const deadline = new Date(attempt.startedAt).getTime() + attempt.durationMinutes * 60 * 1000;
  return now.getTime() > deadline + 15 * 1000; // 15s grace for slow networks
}

function secondsLeft(attempt, now = new Date()) {
  if (!attempt.startedAt) return attempt.durationMinutes * 60;
  const deadline = new Date(attempt.startedAt).getTime() + attempt.durationMinutes * 60 * 1000;
  return Math.max(0, Math.floor((deadline - now.getTime()) / 1000));
}

module.exports = { CATEGORIES, nextDifficulty, pickNextQuestion, scoreAttempt, isExpired, secondsLeft };
