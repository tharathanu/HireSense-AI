// Resume authenticity check (new feature)
// 1. GitHub profile exists and has public activity (free GitHub API)
// 2. LinkedIn link is well-formed (LinkedIn blocks automated checks)
// 3. Each listed skill is backed by a project or experience
const { mentions } = require('../utils/text');

async function checkGithub(username) {
  if (!username) {
    return { checkType: 'GITHUB_PROFILE', target: '—', result: 'UNVERIFIED', detail: 'No GitHub link found in the resume.' };
  }
  try {
    const headers = { 'User-Agent': 'HireSense-AI', Accept: 'application/vnd.github+json' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers });
    if (res.status === 404) {
      return { checkType: 'GITHUB_PROFILE', target: username, result: 'FLAGGED', detail: 'This GitHub profile does not exist.' };
    }
    if (res.status === 403 || res.status === 429) {
      return { checkType: 'GITHUB_PROFILE', target: username, result: 'UNVERIFIED', detail: 'GitHub’s free check limit was reached. Try again later (admins can add a GITHUB_TOKEN to raise the limit).' };
    }
    if (!res.ok) {
      return { checkType: 'GITHUB_PROFILE', target: username, result: 'UNVERIFIED', detail: 'GitHub could not be reached right now.' };
    }
    const data = await res.json();
    const repos = data.public_repos || 0;
    if (repos === 0) {
      return { checkType: 'GITHUB_PROFILE', target: username, result: 'FLAGGED', detail: 'Profile exists but has no public repositories.' };
    }
    return {
      checkType: 'GITHUB_PROFILE',
      target: username,
      result: 'VERIFIED',
      detail: `Profile found with ${repos} public repositor${repos === 1 ? 'y' : 'ies'}.`,
    };
  } catch {
    return { checkType: 'GITHUB_PROFILE', target: username, result: 'UNVERIFIED', detail: 'GitHub could not be reached right now.' };
  }
}

function checkLinkedin(url) {
  if (!url) {
    return { checkType: 'LINKEDIN_URL', target: '—', result: 'UNVERIFIED', detail: 'No LinkedIn link found in the resume.' };
  }
  const valid = /^https:\/\/www\.linkedin\.com\/in\/[A-Za-z0-9\-_%]{3,100}$/.test(url);
  return {
    checkType: 'LINKEDIN_URL',
    target: url,
    result: valid ? 'VERIFIED' : 'FLAGGED',
    detail: valid ? 'Link format is valid. Open it to review the profile.' : 'The LinkedIn link looks malformed.',
  };
}

// A skill is "backed" if it appears in projects or experience, not only in the skills list
function checkSkillEvidence(parsed) {
  const evidenceText = `${parsed.projects || ''}\n${parsed.experience || ''}`;
  const skills = parsed.skills || [];
  if (skills.length === 0) return [];
  const unbacked = skills.filter((s) => !mentions(evidenceText, s));
  const backed = skills.length - unbacked.length;
  const ratio = backed / skills.length;
  return [
    {
      checkType: 'SKILL_EVIDENCE',
      target: `${skills.length} skills`,
      result: ratio >= 0.6 ? 'VERIFIED' : ratio >= 0.3 ? 'UNVERIFIED' : 'FLAGGED',
      detail:
        unbacked.length === 0
          ? 'Every listed skill appears in a project or experience entry.'
          : `${backed} of ${skills.length} skills are backed by projects or experience. Not backed: ${unbacked.slice(0, 10).join(', ')}.`,
    },
  ];
}

async function runChecks(parsed) {
  const github = await checkGithub(parsed.githubUsername);
  return [github, checkLinkedin(parsed.linkedinUrl), ...checkSkillEvidence(parsed)];
}

module.exports = { runChecks, checkGithub, checkLinkedin, checkSkillEvidence };
