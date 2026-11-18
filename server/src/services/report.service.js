// Final cross-round report and personal candidate feedback
const { clamp } = require('../utils/text');

const VIOLATION_PENALTY = {
  PHONE_DETECTED: 15,
  MULTIPLE_FACES: 15,
  CAMERA_OFF: 10,
  TAB_SWITCH: 8,
  FULLSCREEN_EXIT: 6,
  COPY_PASTE: 6,
  NO_FACE: 5,
  LOOKING_AWAY: 3,
};

const WEIGHTS = { resume: 0.2, aptitude: 0.2, gd: 0.2, interview: 0.3, integrity: 0.1 };

const LABELS = {
  resume: 'Resume match',
  aptitude: 'Aptitude test',
  gd: 'Group discussion',
  interview: 'Interview',
  integrity: 'Test integrity',
};

function integrityScore(logs) {
  const penalty = logs.reduce((sum, log) => sum + (VIOLATION_PENALTY[log.type] || 3), 0);
  return clamp(100 - penalty);
}

function recommendationFor(score) {
  if (score >= 80) return 'STRONG_HIRE';
  if (score >= 65) return 'HIRE';
  if (score >= 50) return 'MAYBE';
  return 'REJECT';
}

// app includes: resumeAnalysis, aptitudeAttempt, gdParticipant, interviewSession, integrityLogs
function buildFinalReport(app) {
  const scores = {
    resume: app.resumeAnalysis?.fitScore ?? null,
    aptitude: app.aptitudeAttempt?.score ?? null,
    gd: app.gdParticipant?.impactScore ?? null,
    interview: app.interviewSession?.overallScore ?? null,
    integrity: integrityScore(app.integrityLogs || []),
  };

  // Re-weight across the rounds that actually happened
  let weightSum = 0;
  let total = 0;
  for (const [key, value] of Object.entries(scores)) {
    if (value === null) continue;
    weightSum += WEIGHTS[key];
    total += value * WEIGHTS[key];
  }
  const overallScore = weightSum ? clamp(total / weightSum) : 0;

  const strengths = [];
  const weaknesses = [];
  for (const [key, value] of Object.entries(scores)) {
    if (value === null) continue;
    if (value >= 75) strengths.push(`${LABELS[key]}: ${value}/100`);
    else if (value < 50) weaknesses.push(`${LABELS[key]}: ${value}/100`);
  }
  const missing = app.resumeAnalysis?.missingSkills || [];
  if (missing.length) weaknesses.push(`Missing required skills: ${missing.join(', ')}`);
  const violations = (app.integrityLogs || []).length;
  if (violations) weaknesses.push(`${violations} integrity event${violations === 1 ? '' : 's'} recorded`);

  const recommendation = recommendationFor(overallScore);
  const label = { STRONG_HIRE: 'a strong hire', HIRE: 'a hire', MAYBE: 'a possible hire', REJECT: 'not recommended' }[recommendation];
  const summary = `Overall score ${overallScore}/100 across ${Object.values(scores).filter((v) => v !== null).length - 1} rounds — ${label}. ${
    strengths.length ? `Strongest area: ${strengths[0].split(':')[0]}.` : ''
  } ${weaknesses.length ? `Main concern: ${weaknesses[0].split(':')[0]}.` : ''}`.trim();

  return {
    resumeScore: scores.resume,
    aptitudeScore: scores.aptitude,
    gdScore: scores.gd,
    interviewScore: scores.interview,
    integrityScore: scores.integrity,
    overallScore,
    recommendation,
    strengths,
    weaknesses,
    summary,
  };
}

// Personal feedback for the candidate (written to them, kind and specific)
function buildFeedback(app) {
  const wentWell = [];
  const improve = [];
  const actions = [];

  const ra = app.resumeAnalysis;
  if (ra) {
    if (ra.matchedSkills?.length) wentWell.push(`Your resume showed relevant skills: ${ra.matchedSkills.slice(0, 6).join(', ')}.`);
    if (ra.missingSkills?.length) {
      improve.push(`The role needed skills that your resume did not show: ${ra.missingSkills.join(', ')}.`);
      for (const skill of ra.missingSkills.slice(0, 3)) {
        actions.push(`Build a small project using ${skill} and add it to your resume and GitHub.`);
      }
    }
  }

  const apt = app.aptitudeAttempt;
  if (apt && apt.score !== null && apt.score !== undefined) {
    const cats = Object.entries(apt.categoryScores || {});
    const strong = cats.filter(([, c]) => c.percent >= 70).map(([k]) => k.toLowerCase());
    const weak = cats.filter(([, c]) => c.percent < 50).map(([k]) => k.toLowerCase());
    if (strong.length) wentWell.push(`You did well in ${strong.join(' and ')} aptitude questions.`);
    if (weak.length) {
      improve.push(`Your ${weak.join(' and ')} aptitude scores were below 50%.`);
      actions.push(`Practise 10 ${weak[0]} questions a day for two weeks, timing yourself.`);
    }
  }

  const gd = app.gdParticipant;
  if (gd && gd.impactScore !== null && gd.impactScore !== undefined) {
    if (gd.impactScore >= 70) wentWell.push('You contributed clearly and constructively in the group discussion.');
    if (gd.turnCount < 3) {
      improve.push('You spoke only a few times in the group discussion.');
      actions.push('In discussions, aim to speak early and add at least three points that build on others.');
    } else if ((gd.relevanceScore ?? 100) < 60) {
      improve.push('Some of your discussion points drifted away from the topic.');
      actions.push('Before speaking, link your point back to the topic in your first sentence.');
    }
  }

  const iv = app.interviewSession;
  const answers = iv?.questions?.map((q) => q.answer).filter(Boolean) || [];
  if (answers.length) {
    const avg = (key) => answers.reduce((s, a) => s + (a[key] || 0), 0) / answers.length;
    if (avg('technicalScore') >= 70) wentWell.push('Your interview answers covered the key technical points well.');
    else {
      improve.push('Several interview answers missed key technical points.');
      actions.push('Prepare answers using the STAR method: Situation, Task, Action, Result.');
    }
    if (avg('communicationScore') < 60) {
      improve.push('Your answers could be clearer and better structured.');
      actions.push('Record yourself answering common questions and cut filler words like “basically” and “um”.');
    }
  }

  if ((app.integrityLogs || []).length) {
    improve.push('Some test-integrity events were recorded during your assessments.');
    actions.push('Take future tests in a quiet room, stay in fullscreen and keep your phone away.');
  }

  const passed = app.status === 'HIRED';
  const headline = passed
    ? 'Congratulations — here is what made your application strong.'
    : 'Thank you for applying. Here is honest feedback to help your next application.';

  if (!wentWell.length) wentWell.push('You completed the application process.');
  if (!actions.length) actions.push('Keep building projects and practising mock interviews.');

  return { headline, whatWentWell: wentWell, areasToImprove: improve, learningActions: [...new Set(actions)] };
}

module.exports = { buildFinalReport, buildFeedback, integrityScore, recommendationFor, VIOLATION_PENALTY };
