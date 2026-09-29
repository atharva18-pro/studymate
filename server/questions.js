'use strict';

const REAL_QUESTIONS = require('./questions-data');

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// In the source bank the correct answer is always options[0]. Shuffle the
// options and track where the correct one landed, so the client never
// receives a predictable answer pattern.
function buildQuestion(q, options, answerIndex) {
  const order = shuffleArray(options.map((_, i) => i));
  return {
    q,
    options: order.map(i => options[i]),
    answer: order.indexOf(answerIndex),
  };
}

function genericQuestions(topic, difficulty) {
  let pool;
  if (difficulty === 'easy') {
    pool = [
      ["What is the best first step when starting the topic '" + topic + "'?", ['Understand the basic definitions and key terms', 'Skip straight to the hardest questions', 'Ignore the topic', 'Read it only once and move on']],
      ["In '" + topic + "', which habit helps you remember the most?", ['Making short notes and revising them', 'Reading once and forgetting', 'Not writing anything down', 'Avoiding practice questions']],
      ["If you don't understand a part of '" + topic + "', you should:", ['Ask your teacher or re-read that part slowly', 'Skip it permanently', 'Guess in the exam', 'Stop studying the subject']],
      ["Which is the best way to check if you've really understood '" + topic + "'?", ['Explain it in your own words to someone', 'Memorise it without understanding', 'Never revise it again', 'Avoid all questions on it']],
      ['Why are diagrams or examples useful while learning ' + topic + '?', ['They make abstract ideas easier to picture and recall', 'They are only for decoration', 'They replace the need to study', 'They are never useful']],
      ["When starting '" + topic + "', a good habit is to:", ['Skim the whole topic once before studying it in detail', 'Jump straight into the hardest questions', 'Memorise the chapter number', 'Avoid reading the textbook']],
      ['The easiest way to remember key terms in ' + topic + ' is to:', ['Use flashcards or repeat them out loud', 'Read them once silently', 'Never write them down', 'Skip them']],
      ['If a friend asks you about ' + topic + ', a confident answer usually means:', ['You understood the basics well', 'You memorised without understanding', 'You guessed correctly once', 'None of these matter']],
    ];
  } else if (difficulty === 'hard') {
    pool = [
      ["When solving a tricky, multi-step question on '" + topic + "', the best approach is to:", ['Break it into smaller steps and solve one at a time', 'Guess the final answer directly', 'Skip the question entirely', "Copy a similar question's answer without checking"]],
      ["To truly master '" + topic + "' at an advanced level, you should be able to:", ['Apply the concept to a new, unfamiliar problem', 'Only recite the definition', 'Avoid solving numericals or long answers', 'Memorise one example and stop']],
      ["An advanced exam question on '" + topic + "' is most likely to test:", ['How concepts connect with other chapters', 'Only the spelling of key terms', 'Random unrelated facts', 'Nothing from the syllabus']],
      ['If two methods can solve a hard problem on ' + topic + ', a strong student will:', ['Compare both and pick the more efficient one', 'Always use the longest method', 'Refuse to attempt it', 'Use neither and skip it']],
      ['The best way to prepare ' + topic + ' for a tough exam is to:', ["Practice previous years' hard questions on it", 'Read the chapter title only', 'Avoid timed practice', 'Study it the night before only']],
      ["A hard question on '" + topic + "' that combines two concepts should be tackled by:", ['Identifying both concepts separately, then combining them', 'Guessing which concept matters more', 'Skipping it for being too long', 'Only attempting half of it']],
      ['To check a hard numerical answer on ' + topic + ', you should:', ['Verify it by working backwards or estimating', "Assume it's correct without checking", 'Never double check answers', 'Only check the final digit']],
      ['True mastery of ' + topic + ' at hard level means you can:', ['Teach it and solve unfamiliar variations', 'Only recall it during a test', 'Recognise it but not solve it', 'Avoid all related exam questions']],
    ];
  } else {
    pool = [
      ["Which approach best builds real understanding of '" + topic + "'?", ['Learning the concept, then practising varied questions on it', 'Only memorising without practising', 'Skipping the theory and guessing answers', 'Copying answers without understanding']],
      ["What is a good way to test your grasp of '" + topic + "' before an exam?", ['Attempt questions without looking at notes first', 'Only re-read the chapter passively', 'Avoid attempting any questions', 'Ask someone else to take the test for you']],
      ["If a question on '" + topic + "' looks unfamiliar, you should first:", ['Identify which concept from the chapter it is testing', 'Leave it blank immediately', 'Panic and skip the whole test', 'Write anything without reading it']],
      ['Which of these shows solid preparation in ' + topic + '?', ['Being able to explain the concept and solve related problems', 'Only knowing the chapter name', 'Recognising the topic but nothing else', 'Guessing every answer']],
      ["A common mistake students make while answering '" + topic + "' questions is:", ['Not reading the question carefully before answering', 'Reading the question twice', 'Checking their answer at the end', 'Managing their time well']],
      ['At medium difficulty, a question on ' + topic + ' usually expects you to:', ['Apply the concept to a slightly new situation', 'Just repeat the definition word for word', 'Ignore the given data', "Guess based on the question's length"]],
      ['The most reliable way to improve at ' + topic + ' between easy and hard level is to:', ['Practice a mix of question types regularly', 'Only read the summary once', 'Avoid mixed practice', 'Wait until the night before the exam']],
      ['When revising ' + topic + ' at this level, it helps to:', ['Re-attempt questions you got wrong before', 'Only look at questions you already got right', 'Skip revision entirely', 'Read only the chapter title']],
    ];
  }
  return shuffleArray(pool).slice(0, 5).map(([q, options]) => buildQuestion(q, options, 0));
}

function getQuestionsForTopic(topic, difficulty) {
  if (difficulty === 'medium' && REAL_QUESTIONS[topic]) {
    return shuffleArray(REAL_QUESTIONS[topic]).slice(0, 5).map(item =>
      buildQuestion(item.q, item.options, item.answer));
  }
  return genericQuestions(topic, difficulty);
}

// Strip answers for safe transmission to the client.
function publicQuestions(questions) {
  return questions.map(({ q, options }) => ({ q, options }));
}

module.exports = { getQuestionsForTopic, publicQuestions };
