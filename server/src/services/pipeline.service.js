// Moves applications through the hiring stages
const prisma = require('../lib/prisma');
const HttpError = require('../utils/httpError');
const { notify } = require('./notify.service');
const { buildFinalReport, buildFeedback } = require('./report.service');

const STAGES = ['SCREENING', 'APTITUDE', 'GROUP_DISCUSSION', 'INTERVIEW', 'FINAL_REVIEW'];
const STAGE_LABEL = {
  SCREENING: 'Resume screening',
  APTITUDE: 'Aptitude test',
  GROUP_DISCUSSION: 'Group discussion',
  INTERVIEW: 'Interview',
  FINAL_REVIEW: 'Final review',
};

const REPORT_INCLUDE = {
  resumeAnalysis: true,
  aptitudeAttempt: true,
  gdParticipant: true,
  interviewSession: { include: { questions: { include: { answer: true } } } },
  integrityLogs: true,
  candidate: true,
  job: true,
};

async function loadForReport(applicationId) {
  return prisma.application.findUnique({ where: { id: applicationId }, include: REPORT_INCLUDE });
}

async function generateReport(applicationId) {
  const app = await loadForReport(applicationId);
  const data = buildFinalReport(app);
  return prisma.finalReport.upsert({
    where: { applicationId },
    update: { ...data, generatedAt: new Date() },
    create: { applicationId, ...data },
  });
}

async function generateFeedback(applicationId, release = false) {
  const app = await loadForReport(applicationId);
  const data = buildFeedback(app);
  return prisma.candidateFeedback.upsert({
    where: { applicationId },
    update: { ...data, ...(release ? { isReleased: true } : {}) },
    create: { applicationId, ...data, isReleased: release },
  });
}

async function recordHistory(app, toStage, status, actorId, note) {
  await prisma.stageHistory.create({
    data: { applicationId: app.id, fromStage: app.stage, toStage, status, changedById: actorId, note: note || null },
  });
}

async function candidateUserId(app) {
  const profile = await prisma.candidateProfile.findUnique({ where: { id: app.candidateId } });
  return profile?.userId;
}

async function advance(app, actorId) {
  if (app.status === 'REJECTED' || app.status === 'HIRED' || app.status === 'WITHDRAWN') {
    throw new HttpError(400, 'This application is already closed.');
  }
  const idx = STAGES.indexOf(app.stage);
  if (idx === STAGES.length - 1) throw new HttpError(400, 'This candidate is already in final review.');
  const next = STAGES[idx + 1];

  if (next === 'APTITUDE') {
    await prisma.aptitudeAttempt.upsert({ where: { applicationId: app.id }, update: {}, create: { applicationId: app.id } });
  }
  if (next === 'INTERVIEW') {
    await prisma.interviewSession.upsert({ where: { applicationId: app.id }, update: {}, create: { applicationId: app.id } });
  }

  const updated = await prisma.application.update({
    where: { id: app.id },
    data: { stage: next, status: 'SHORTLISTED' },
  });
  await recordHistory(app, next, 'SHORTLISTED', actorId);

  if (next === 'FINAL_REVIEW') await generateReport(app.id);

  const messages = {
    APTITUDE: 'You have been shortlisted. Your aptitude test is ready — open your applications to start it.',
    GROUP_DISCUSSION: 'You cleared the aptitude round. You will receive a group discussion slot soon.',
    INTERVIEW: 'You cleared the group discussion. Your voice interview is ready — open your applications to start it.',
    FINAL_REVIEW: 'You have completed all rounds. The recruiter is reviewing your final report.',
  };
  const userId = await candidateUserId(app);
  if (userId) {
    await notify(userId, {
      title: `${app.job.title}: moved to ${STAGE_LABEL[next]}`,
      message: messages[next],
      link: '/candidate/applications',
    });
  }
  return updated;
}

async function close(app, status, actorId, note) {
  if (app.status === 'REJECTED' || app.status === 'HIRED' || app.status === 'WITHDRAWN') {
    throw new HttpError(400, 'This application is already closed.');
  }
  const updated = await prisma.application.update({ where: { id: app.id }, data: { status } });
  await recordHistory({ ...app }, app.stage, status, actorId, note);
  await generateReport(app.id);
  await generateFeedback(app.id, true);

  const userId = await candidateUserId(app);
  if (userId) {
    await notify(userId, {
      title: status === 'HIRED' ? `Offer update: ${app.job.title}` : `Application update: ${app.job.title}`,
      message:
        status === 'HIRED'
          ? 'Congratulations! You have been selected. The recruiter will contact you with next steps. Your feedback report is now available.'
          : 'Thank you for applying. You were not selected this time. Your personal feedback report is now available.',
      link: '/candidate/feedback',
    });
  }
  return updated;
}

module.exports = { STAGES, STAGE_LABEL, advance, close, generateReport, generateFeedback, loadForReport };
