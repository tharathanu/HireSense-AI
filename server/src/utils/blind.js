// Blind screening: hides identity details while a job is in the screening stage

function isBlind(application, job) {
  return Boolean(job?.blindScreening && application.stage === 'SCREENING');
}

function anonymousName(applicationId) {
  return `Candidate ${applicationId.slice(-5).toUpperCase()}`;
}

// Returns a copy of the candidate data that is safe to show in blind mode
function maskCandidate(application, job) {
  if (!isBlind(application, job)) return { ...application, isBlind: false };

  const candidate = application.candidate || {};
  const masked = {
    ...application,
    isBlind: true,
    candidate: {
      id: candidate.id,
      user: { fullName: anonymousName(application.id), email: null },
      phone: null,
      location: null,
      gender: null,
      college: null,
      degree: null,
      graduationYear: null,
      photoUrl: null,
      linkedinUrl: null,
      githubUrl: null,
      headline: candidate.headline || null,
    },
  };

  if (application.resume) {
    const parsed = application.resume.parsedData || {};
    masked.resume = {
      id: application.resume.id,
      fileName: 'Hidden during blind screening',
      parsedData: {
        skills: parsed.skills || [],
        projects: parsed.projects || '',
        projectTitles: parsed.projectTitles || [],
        experience: parsed.experience || '',
        certifications: parsed.certifications || '',
      },
      extractedText: null,
    };
  }
  return masked;
}

module.exports = { isBlind, maskCandidate, anonymousName };
