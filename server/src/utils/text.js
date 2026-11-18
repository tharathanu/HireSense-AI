// Small text helpers shared by the scoring services

const STOP_WORDS = new Set(
  'a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those i you he she we they me my our your their them his her not no yes do does did so than then there here what which who whom how why when where can could should would will shall may might must have has had also just very more most such into about over under again further once all any both each few other some own same too only up down out off'.split(' ')
);

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalize(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9+#.\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Meaningful words (no stop words, at least 3 letters)
function keywords(text) {
  return normalize(text)
    .split(' ')
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function wordCount(text) {
  const t = (text || '').trim();
  return t ? t.split(/\s+/).length : 0;
}

// Escapes a string so it can be used inside a RegExp
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// True if `skill` appears in `text` as a whole word/phrase.
// Very short names like "C", "Go" or "R" must match exactly (case-sensitive),
// so ordinary words such as "go" are not mistaken for skills.
function mentions(text, skill) {
  const short = skill.length <= 2;
  const pattern = new RegExp(
    `(^|[^A-Za-z0-9+#])${escapeRegex(skill)}(?![A-Za-z0-9+#])`,
    short ? '' : 'i'
  );
  return pattern.test(text || '');
}

function average(nums) {
  const list = nums.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (list.length === 0) return null;
  return list.reduce((a, b) => a + b, 0) / list.length;
}

module.exports = { clamp, normalize, keywords, wordCount, mentions, escapeRegex, average, STOP_WORDS };
