const mammoth = require('mammoth');
const HttpError = require('../utils/httpError');
const { mentions } = require('../utils/text');
const { askJson } = require('../lib/ai');

const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// ---------- 1. Text extraction ----------

// Mozilla pdf.js (ES module) loaded once, on first use
let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsPromise;
}

async function pdfToText(buffer) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;
  const pages = [];
  for (let i = 1; i <= Math.min(doc.numPages, 10); i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Rebuild lines using each text item's vertical position
    let lastY = null;
    let line = '';
    const lines = [];
    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line);
        line = '';
      }
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = '';
      }
      lastY = y;
    }
    if (line) lines.push(line);
    pages.push(lines.join('\n'));
  }
  await doc.destroy();
  return pages.join('\n');
}

async function extractText(buffer, mimeType) {
  let text = '';
  try {
    if (mimeType === PDF) {
      text = await pdfToText(buffer);
    } else if (mimeType === DOCX) {
      text = (await mammoth.extractRawText({ buffer })).value;
    } else {
      throw new HttpError(400, 'Only PDF and DOCX files are supported.');
    }
 } catch (err) {
    if (err instanceof HttpError) throw err;

    console.error('Resume extraction failed:', {
        name: err?.name,
        message: err?.message,
        mimeType,
        fileSize: buffer?.length,
    });

    throw new HttpError(400, 'This file could not be read. Please upload a text-based PDF or DOCX.');
}
  text = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length < 80) {
    throw new HttpError(400, 'Very little text was found. Scanned images cannot be read — please upload a text-based resume.');
  }
  return text;
}

// ---------- 2. Section splitting ----------

const SECTION_HEADINGS = {
  summary: ['summary', 'professional summary', 'profile', 'objective', 'career objective', 'about me'],
  education: ['education', 'academic background', 'academics', 'educational qualifications', 'qualifications'],
  experience: ['experience', 'work experience', 'internship experience', 'internships', 'professional experience', 'employment history'],
  projects: ['projects', 'academic projects', 'personal projects', 'key projects'],
  skills: ['skills', 'technical skills', 'core skills', 'key skills', 'technologies'],
  certifications: ['certifications', 'certificates', 'courses', 'licenses'],
  achievements: ['achievements', 'awards', 'accomplishments', 'honors', 'extracurricular activities'],
};

function detectHeading(line) {
  const clean = line.toLowerCase().replace(/[^a-z\s]/g, '').trim();
  if (!clean || clean.split(' ').length > 4) return null;
  for (const [section, names] of Object.entries(SECTION_HEADINGS)) {
    if (names.includes(clean)) return section;
  }
  return null;
}

function splitSections(text) {
  const sections = { header: [] };
  let current = 'header';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const heading = detectHeading(line);
    if (heading) {
      current = heading;
      sections[current] = sections[current] || [];
      continue;
    }
    sections[current] = sections[current] || [];
    sections[current].push(line);
  }
  const result = {};
  for (const [key, lines] of Object.entries(sections)) result[key] = lines.join('\n');
  return result;
}

// ---------- 3. Contact details & links ----------

function extractLinks(text) {
  const github = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9-]{1,39})(?![A-Za-z0-9-])/i);
  const linkedin = text.match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9\-_%]{3,100})/i);
  const email = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  const phone = text.match(/(?:\+?\d{1,3}[\s-]?)?\d{10}|\+?\d{1,3}[\s-]\d{5}[\s-]\d{5}/);
  return {
    githubUsername: github ? github[1] : null,
    githubUrl: github ? `https://github.com/${github[1]}` : null,
    linkedinUrl: linkedin ? `https://www.linkedin.com/in/${linkedin[1]}` : null,
    email: email ? email[0] : null,
    phone: phone ? phone[0].trim() : null,
  };
}

// ---------- 4. Skills ----------

function detectSkills(text, skillNames) {
  return skillNames.filter((skill) => mentions(text, skill));
}

// Pulls project names from the projects section.
// Handles "Name – description", "Name | Tech" and a name on its own line,
// and skips bullet points and "Technologies:" lines.
const META_LINE = /^(technolog(y|ies)|tech stack|tools|stack|built with|skills used|role|duration|link|github)\s*[:\-]/i;

function extractProjects(projectsText) {
  if (!projectsText) return [];
  const titles = [];
  for (const raw of projectsText.split('\n')) {
    const line = raw.trim();
    if (!line || /^[•\-*●▪◦‣]/.test(line) || META_LINE.test(line)) continue;
    const head = line.split(/\s[–—|]\s|\s-\s|:\s/)[0].trim();
    const words = head.split(/\s+/).length;
    // A title is short and starts with a capital letter or a digit
    if (head.length >= 3 && head.length <= 60 && words <= 8 && /^[A-Z0-9]/.test(head) && !/[.!?]$/.test(head)) {
      titles.push(head);
    }
  }
  return [...new Set(titles)].slice(0, 8);
}

// ---------- 5. Full parse (rule-based, optionally improved by AI) ----------

async function parseResume(text, skillNames) {
  const sections = splitSections(text);
  const links = extractLinks(text);
  const skills = detectSkills(text, skillNames);
  const firstLine = (sections.header || '').split('\n')[0] || '';
  const looksLikeName = /^[A-Za-z][A-Za-z .'-]{1,50}$/.test(firstLine.trim());

  const parsed = {
    name: looksLikeName ? firstLine.trim() : null,
    ...links,
    skills,
    summary: sections.summary || '',
    education: sections.education || '',
    experience: sections.experience || '',
    projects: sections.projects || '',
    projectTitles: extractProjects(sections.projects),
    certifications: sections.certifications || '',
    achievements: sections.achievements || '',
    aiEnhanced: false,
  };

  const ai = await askJson(
    'You extract structured data from resumes. Never invent information that is not in the text.',
    `From this resume text, return JSON with keys:
"summary" (2 sentences describing the candidate), "projectTitles" (array of project names),
"experienceYears" (number, internships count as fractions), "extraSkills" (technical skills mentioned but missing from this list: ${skills.join(', ')}).
Resume:\n${text.slice(0, 12000)}`
  );
  if (ai) {
    if (typeof ai.summary === 'string' && ai.summary.length > 20) parsed.aiSummary = ai.summary;
    if (Array.isArray(ai.projectTitles) && ai.projectTitles.length) parsed.projectTitles = ai.projectTitles.slice(0, 10).map(String);
    if (typeof ai.experienceYears === 'number') parsed.experienceYears = ai.experienceYears;
    if (Array.isArray(ai.extraSkills)) {
      parsed.extraSkills = ai.extraSkills.map(String).filter((s) => mentions(text, s)).slice(0, 20);
    }
    parsed.aiEnhanced = true;
  }
  return parsed;
}

module.exports = { extractText, splitSections, extractLinks, detectSkills, extractProjects, parseResume, PDF, DOCX };
