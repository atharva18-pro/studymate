'use strict';

const GENERAL_KNOWLEDGE = require('./gk-data');
const { AI_COSTS } = require('./constants');

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const STUDY_PLAN_VARIANTS = [
  "📅 Try this: 40 minutes of focused study, then a 10 minute break, repeat 3-4 times. Put your toughest subject in your first session when you're freshest.",
  "📅 Here's one plan: mornings for the subject you find hardest, evenings for revision of what you studied earlier in the day, and one full topic test every 2-3 days.",
  "📅 A simple weekly rhythm: Mon/Wed/Fri new topics, Tue/Thu revision + practice tests, weekends for weak areas and one mock test.",
  '📅 Use the Pomodoro method: 25 minutes study, 5 minute break, and after 4 rounds take a longer 20-30 minute break. Track how many rounds you finish each day.',
];

const REVISION_VARIANTS = [
  '🔁 Active recall works best: learn → close the book → try to recall everything → check what you missed → repeat only the missed parts.',
  '🔁 Try spaced revision: revisit a topic after 1 day, then 3 days, then a week. Spacing it out beats cramming.',
  '🔁 Turn your notes into questions and quiz yourself instead of just re-reading — re-reading feels productive but recall is what actually sticks.',
  '🔁 Teach the topic to someone (or out loud to yourself) — if you can explain it simply, you\'ve actually learned it.',
];

const EXAM_VARIANTS = [
  "📝 For exams: solve previous years' papers under time pressure, revise your weakest 20% of topics the most, and do a full mock test at least once.",
  '📝 Exam strategy: read the whole paper first, attempt questions you\'re confident about first to build momentum, then tackle the harder ones.',
  '📝 In the last week before an exam, stop learning new topics — focus only on revision, practice tests, and reviewing your mistakes.',
];

const MOTIVATION_VARIANTS = [
  '💪 Progress beats perfection — a little consistent study every day adds up more than one long session before the exam.',
  '💪 Getting a question wrong in practice is exactly how you find out what to fix before the real test — that\'s a win, not a failure.',
  '💪 You don\'t need to feel motivated to start — start for 5 minutes, and motivation usually follows.',
];

// knownTopics: map of chapter name -> subject name for this student.
function getTopicExplanation(topic, knownTopics) {
  const subjectHint = knownTopics[topic] || '';
  let frame;
  if (subjectHint === 'Mathematics') {
    frame = 'In Maths, focus on the formula or rule first, then work through 2-3 solved examples, then attempt problems without looking at the solution.';
  } else if (['Science', 'Physics', 'Chemistry', 'Biology'].includes(subjectHint)) {
    frame = "In Science, learn the definition, understand the reasoning ('why' it happens), sketch any diagram from memory, then apply it to a real-life example or numerical.";
  } else if (['Social Science', 'Economics', 'Business Studies', 'Accountancy'].includes(subjectHint)) {
    frame = 'For this kind of chapter, understand the cause-and-effect or the process first, note down key dates/terms, and practise writing short answers in your own words.';
  } else {
    frame = 'Start with the core idea in simple words, then look at an example, then try explaining it without notes.';
  }

  return '📘 ' + topic + '\n\n' +
    "What it's about: " + topic + ' is a chapter you should be able to explain in your own words — start by identifying its 2-3 most important ideas.\n\n' +
    'How to study it: ' + frame + '\n\n' +
    'Key ideas to remember: Definitions/formulas first, then how they connect to earlier chapters, then common exam question patterns.\n\n' +
    'Quick tip: Teach this topic out loud to yourself or a friend for 2 minutes — if you get stuck explaining a part, that\'s exactly what to re-study.';
}

function findMatchingTopic(question, knownTopics) {
  const q = question.toLowerCase();
  let bestMatch = null;
  for (const topic of Object.keys(knownTopics)) {
    if (q.includes(topic.toLowerCase())) {
      if (!bestMatch || topic.length > bestMatch.length) bestMatch = topic;
    }
  }
  if (bestMatch) return bestMatch;

  const words = q.replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(w => w.length > 3);
  let best = null, bestScore = 0;
  for (const topic of Object.keys(knownTopics)) {
    const tl = topic.toLowerCase();
    let score = 0;
    for (const w of words) if (tl.includes(w)) score++;
    if (score > bestScore) { bestScore = score; best = topic; }
  }
  // Require at least two matched words so single common words ("india",
  // "light") don't hijack questions that should hit general knowledge.
  return bestScore >= 2 ? best : null;
}

function findGeneralKnowledge(question) {
  const q = question.toLowerCase().replace(/[?!.]/g, '').trim();
  if (GENERAL_KNOWLEDGE[q]) return GENERAL_KNOWLEDGE[q];

  let bestKey = null, bestScore = 0;
  for (const key of Object.keys(GENERAL_KNOWLEDGE)) {
    const keyWords = key.split(' ');
    // Threshold over words that can actually score (length > 2), otherwise
    // keys like "capital of india" need 3/3 while "of" can never match.
    const counted = keyWords.filter(w => w.length > 2).length;
    let score = 0;
    for (const w of keyWords) if (w.length > 2 && q.includes(w)) score++;
    if (counted > 0 && score >= Math.ceil(counted * 0.7) && score > bestScore) { bestScore = score; bestKey = key; }
  }
  return bestKey ? GENERAL_KNOWLEDGE[bestKey] : null;
}

function getAIResponse(question, knownTopics, standard) {
  const q = question.toLowerCase();

  const matchedTopic = findMatchingTopic(question, knownTopics);
  if (matchedTopic && (q.includes('explain') || q.includes('what is') || q.includes('help with') || q.includes('teach') || matchedTopic.toLowerCase() === q.trim())) {
    return getTopicExplanation(matchedTopic, knownTopics);
  }

  const gkAnswer = findGeneralKnowledge(question);
  if (gkAnswer) return '🌍 ' + gkAnswer;

  if (q.includes('study plan') || (q.includes('plan') && q.includes('study'))) {
    const std = standard ? ' for ' + standard + ' standard' : '';
    return pick(STUDY_PLAN_VARIANTS) + std;
  }
  if (q.includes('revis')) return pick(REVISION_VARIANTS);
  if (q.includes('exam') || q.includes('test prep')) return pick(EXAM_VARIANTS);
  if (q.includes('demotivat') || q.includes('give up') || q.includes("can't do") || q.includes('cant do') || q.includes('bored')) {
    return pick(MOTIVATION_VARIANTS);
  }

  if (matchedTopic) return getTopicExplanation(matchedTopic, knownTopics);

  if (q.includes('math')) return "📐 Maths tip: understand the rule, work through 2-3 solved examples, then attempt fresh questions without checking the solution first. Ask me to 'explain' any specific chapter name for a full breakdown.";
  if (q.includes('science') || q.includes('physics') || q.includes('chemistry') || q.includes('biology')) return '🔬 Science tip: learn the definition, understand the \'why\', sketch the diagram from memory, then apply it to a real example. Ask me to \'explain\' a specific chapter for a full breakdown.';
  if (q.includes('english')) return '📖 English tip: for literature, focus on theme and characters; for grammar, practise applying the rule in your own sentences rather than just memorising it.';
  if (q.includes('social') || q.includes('history') || q.includes('geography') || q.includes('civics')) return '🌍 Social Science tip: note the cause → event → effect chain for history, and use maps/diagrams for geography. Practice writing short answers in your own words.';

  return '📚 I can explain any chapter you\'ve added (just say \'explain <chapter name>\'), suggest a study plan, share revision or exam tips, or talk you through a topic you\'re stuck on. What would help right now?';
}

// Mirrors getAIResponse() so the credit cost can be decided before answering.
function classifyAIRequestType(question, knownTopics) {
  const q = question.toLowerCase();
  const matchedTopic = findMatchingTopic(question, knownTopics);

  if (matchedTopic && (q.includes('explain') || q.includes('what is') || q.includes('help with') || q.includes('teach') || matchedTopic.toLowerCase() === q.trim())) {
    return 'detailed';
  }
  if (findGeneralKnowledge(question)) return 'simple';
  if (q.includes('study plan') || (q.includes('plan') && q.includes('study'))) return 'studyPlan';
  if (q.includes('revis')) return 'simple';
  if (q.includes('exam') || q.includes('test prep')) return 'simple';
  if (q.includes('demotivat') || q.includes('give up') || q.includes("can't do") || q.includes('cant do') || q.includes('bored')) return 'simple';
  if (matchedTopic) return 'detailed';
  return 'simple';
}

module.exports = { AI_COSTS, getAIResponse, getTopicExplanation, classifyAIRequestType, findMatchingTopic };
