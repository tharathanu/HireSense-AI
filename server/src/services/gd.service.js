// Group discussion scoring: participation, relevance and leadership
const { clamp, keywords, wordCount } = require('../utils/text');
const { askJson } = require('../lib/ai');

const BUILDING_PHRASES = [
  'i agree', 'i disagree', 'building on', 'adding to', 'to add', 'as mentioned', 'good point',
  'to summarize', 'to summarise', 'in conclusion', "let's", 'let us', 'what do you think',
  'on the other hand', 'for example', 'for instance', 'another perspective',
];

// participants: [{ id, entries: [{ text, spokenAt }] }]
// topic: { title, description }
function scoreDiscussion(participants, topic) {
  const topicWords = new Set(keywords(`${topic.title} ${topic.description || ''}`));
  const allEntries = participants.flatMap((p) => p.entries.map((e) => ({ ...e, participantId: p.id })));
  allEntries.sort((a, b) => new Date(a.spokenAt) - new Date(b.spokenAt));
  const firstSpeaker = allEntries[0]?.participantId;
  const totalWords = allEntries.reduce((sum, e) => sum + wordCount(e.text), 0);
  const n = participants.length || 1;

  return participants.map((p) => {
    const words = p.entries.reduce((sum, e) => sum + wordCount(e.text), 0);
    const turns = p.entries.length;
    const text = p.entries.map((e) => e.text).join(' ').toLowerCase();

    // Participation: compared to an equal share of the discussion
    const ratio = totalWords ? (words / totalWords) * n : 0;
    let participation;
    if (ratio >= 0.7 && ratio <= 1.6) participation = 100;
    else if (ratio < 0.7) participation = (ratio / 0.7) * 100;
    else participation = 100 - (ratio - 1.6) * 40; // dominating the discussion
    participation = clamp(participation);

    // Relevance: share of turns that touch the topic's key words
    const onTopicTurns = p.entries.filter((e) => keywords(e.text).some((w) => topicWords.has(w))).length;
    const relevance = turns ? clamp((onTopicTurns / turns) * 100) : 0;

    // Leadership: opening the discussion, building on others, summarising
    const phraseHits = BUILDING_PHRASES.filter((ph) => text.includes(ph)).length;
    const questions = (text.match(/\?/g) || []).length;
    const leadership = turns ? clamp((p.id === firstSpeaker ? 30 : 0) + phraseHits * 12 + questions * 6 + Math.min(turns, 6) * 5) : 0;

    const impact = clamp(participation * 0.4 + relevance * 0.35 + leadership * 0.25);
    const speakingSeconds = Math.round((words / 150) * 60); // ~150 words per minute

    return {
      participantId: p.id,
      turnCount: turns,
      speakingSeconds,
      impactScore: turns ? impact : 0,
      relevanceScore: relevance,
      leadershipScore: leadership,
      summary: turns
        ? `Spoke ${turns} time${turns === 1 ? '' : 's'} (about ${words} words). ${relevance >= 60 ? 'Stayed on topic.' : 'Often drifted from the topic.'} ${leadership >= 50 ? 'Showed initiative and built on others’ points.' : 'Could take more initiative.'}`
        : 'Did not speak during the discussion.',
    };
  });
}

// Optional AI pass: improves relevance and writes a fairer summary
async function refineWithAI(results, participants, topic) {
  const transcript = participants
    .map((p) => `Participant ${p.id}:\n${p.entries.map((e) => `- ${e.text}`).join('\n')}`)
    .join('\n\n')
    .slice(0, 12000);
  if (!transcript.trim()) return results;

  const ai = await askJson(
    'You evaluate group discussions for hiring. Be fair and brief.',
    `Topic: ${topic.title}\n${topic.description || ''}\n\nTranscript:\n${transcript}\n
Return JSON {"participants":[{"id":"...","relevance":0-100,"summary":"one sentence"}]}`
  );
  if (!ai || !Array.isArray(ai.participants)) return results;

  return results.map((r) => {
    const match = ai.participants.find((x) => x.id === r.participantId);
    if (!match || typeof match.relevance !== 'number' || r.turnCount === 0) return r;
    const relevance = clamp((r.relevanceScore + clamp(match.relevance)) / 2);
    const participation = clamp((r.impactScore - relevance * 0.35 - r.leadershipScore * 0.25) / 0.4);
    return {
      ...r,
      relevanceScore: relevance,
      impactScore: clamp(participation * 0.4 + relevance * 0.35 + r.leadershipScore * 0.25),
      summary: typeof match.summary === 'string' ? match.summary : r.summary,
    };
  });
}

module.exports = { scoreDiscussion, refineWithAI };
