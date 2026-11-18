const { clamp, keywords } = require('../utils/text');
const { askJson } = require('../lib/ai');

// Scores how well a parsed resume fits a job.
// skills: [{ name, isRequired }]
function ruleBasedMatch(parsed, job, skills) {
  const candidateSkills = new Set([...(parsed.skills || []), ...(parsed.extraSkills || [])].map((s) => s.toLowerCase()));
  const required = skills.filter((s) => s.isRequired);
  const optional = skills.filter((s) => !s.isRequired);

  const matchedRequired = required.filter((s) => candidateSkills.has(s.name.toLowerCase()));
  const matchedOptional = optional.filter((s) => candidateSkills.has(s.name.toLowerCase()));
  const missing = required.filter((s) => !candidateSkills.has(s.name.toLowerCase())).map((s) => s.name);

  const skillCoverage = required.length ? (matchedRequired.length / required.length) * 100 : 100;
  const optionalBonus = optional.length ? (matchedOptional.length / optional.length) * 100 : 0;

  // How much of the job description vocabulary appears in the resume
  const resumeWords = new Set(keywords([parsed.summary, parsed.experience, parsed.projects, parsed.skills?.join(' ')].join(' ')));
  const jdWords = [...new Set(keywords(job.description))];
  const overlap = jdWords.length ? (jdWords.filter((w) => resumeWords.has(w)).length / jdWords.length) * 100 : 0;

  const evidence = (parsed.projects ? 50 : 0) + (parsed.experience ? 50 : 0);

  const fitScore = clamp(skillCoverage * 0.6 + overlap * 0.15 + optionalBonus * 0.1 + evidence * 0.15);

  const strengths = [];
  if (matchedRequired.length) strengths.push(`Has ${matchedRequired.length} of ${required.length} required skills: ${matchedRequired.map((s) => s.name).join(', ')}.`);
  if (parsed.projects) strengths.push('Lists hands-on projects that show practical work.');
  if (parsed.experience) strengths.push('Has internship or work experience.');
  if (matchedOptional.length) strengths.push(`Also knows ${matchedOptional.map((s) => s.name).join(', ')}.`);

  const gaps = [];
  if (missing.length) gaps.push(`Missing required skills: ${missing.join(', ')}.`);
  if (!parsed.projects) gaps.push('No projects section was found.');
  if (!parsed.experience) gaps.push('No internship or work experience was found.');

  return {
    fitScore,
    skillCoverage: clamp(skillCoverage),
    matchedSkills: [...matchedRequired, ...matchedOptional].map((s) => s.name),
    missingSkills: missing,
    strengths,
    gaps,
    summary: `Matches ${matchedRequired.length} of ${required.length} required skills with a job-fit score of ${fitScore}.`,
  };
}

async function matchResumeToJob(parsed, resumeText, job, skills) {
  const base = ruleBasedMatch(parsed, job, skills);

  const ai = await askJson(
    'You are a fair technical recruiter. Judge only from evidence in the resume.',
    `Job title: ${job.title}
Job description: ${job.description.slice(0, 3000)}
Required skills: ${skills.filter((s) => s.isRequired).map((s) => s.name).join(', ')}
Resume:\n${resumeText.slice(0, 9000)}

Return JSON: {"fit": number 0-100 for overall suitability, "strengths": [up to 3 short points], "gaps": [up to 3 short points], "summary": "2 sentences"}`
  );

  if (ai && typeof ai.fit === 'number') {
    // Skill coverage stays the backbone of the score so results remain explainable
    base.fitScore = clamp(base.skillCoverage * 0.6 + clamp(ai.fit) * 0.4);
    if (Array.isArray(ai.strengths) && ai.strengths.length) base.strengths = ai.strengths.slice(0, 4).map(String);
    if (Array.isArray(ai.gaps) && ai.gaps.length) base.gaps = [...new Set([...base.gaps.slice(0, 1), ...ai.gaps.map(String)])].slice(0, 4);
    if (typeof ai.summary === 'string') base.summary = ai.summary;
  }
  return base;
}

module.exports = { ruleBasedMatch, matchResumeToJob };
