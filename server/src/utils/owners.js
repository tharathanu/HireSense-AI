// Loads the profile for the logged-in user and checks ownership of records
const prisma = require('../lib/prisma');
const HttpError = require('./httpError');

async function candidateProfileOf(userId) {
  const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
  if (!profile) throw new HttpError(403, 'Candidate profile not found.');
  return profile;
}

async function recruiterProfileOf(userId) {
  const profile = await prisma.recruiterProfile.findUnique({ where: { userId } });
  if (!profile) throw new HttpError(403, 'Recruiter profile not found.');
  return profile;
}

// The candidate's own application (or 404)
async function ownApplication(userId, applicationId, include = {}) {
  const profile = await candidateProfileOf(userId);
  const app = await prisma.application.findFirst({
    where: { id: applicationId, candidateId: profile.id },
    include: { job: true, ...include },
  });
  if (!app) throw new HttpError(404, 'Application not found.');
  return app;
}

// An application for one of the recruiter's own jobs (or 404)
async function recruiterApplication(userId, applicationId, include = {}) {
  const profile = await recruiterProfileOf(userId);
  const app = await prisma.application.findFirst({
    where: { id: applicationId, job: { recruiterId: profile.id } },
    include: { job: true, ...include },
  });
  if (!app) throw new HttpError(404, 'Application not found.');
  return app;
}

async function recruiterJob(userId, jobId) {
  const profile = await recruiterProfileOf(userId);
  const job = await prisma.job.findFirst({ where: { id: jobId, recruiterId: profile.id } });
  if (!job) throw new HttpError(404, 'Job not found.');
  return job;
}

module.exports = { candidateProfileOf, recruiterProfileOf, ownApplication, recruiterApplication, recruiterJob };
