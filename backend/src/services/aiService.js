// Lightweight local AI service.
// Provides summarization, question generation, flashcards, quizzes, and
// document Q&A without requiring an external API key. The interface is
// designed so a real LLM provider (OpenAI, etc.) can be plugged in later.

function cleanText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function sentences(text) {
  return cleanText(text)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function summarize(text, maxPoints = 5) {
  const clean = cleanText(text);
  if (!clean) return { summary: '', points: [] };
  const sents = sentences(clean);
  if (sents.length <= 3) {
    return { summary: clean, points: [clean] };
  }

  const stopWords = new Set('the a an and or but of to in on for with at by from as is are was were be been being it this that these those have has had not no so if then than too very can will just should'.split(' '));
  const freq = {};
  sents.forEach((s) => {
    s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).forEach((w) => {
      if (w.length > 2 && !stopWords.has(w)) freq[w] = (freq[w] || 0) + 1;
    });
  });

  const scored = sents.map((s) => {
    const words = s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/);
    let score = 0;
    words.forEach((w) => {
      if (freq[w]) score += freq[w];
    });
    return { s, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const points = scored.slice(0, maxPoints).map((x) => x.s.trim());
  const summary = `This content covers ${Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 5).join(', ')}. ` + points.join(' ');
  return { summary, points };
}

function generateQuestions(text, count = 5) {
  const sents = sentences(text).filter((s) => s.split(' ').length > 5);
  if (sents.length === 0) return [];
  const questions = [];
  const used = new Set();
  let i = 0;
  while (questions.length < count && i < sents.length * 3) {
    const s = sents[i % sents.length];
    if (!used.has(s)) {
      used.add(s);
      questions.push(`Explain: ${s.replace(/[.!?]$/, '')}?`);
    }
    i++;
  }
  return questions;
}

function generateFlashcards(text, count = 6) {
  const sents = sentences(text).filter((s) => s.indexOf(',') !== -1 || s.split(' ').length > 8);
  const cards = [];
  const used = new Set();
  for (const s of sents) {
    if (cards.length >= count) break;
    if (used.has(s)) continue;
    used.add(s);
    const parts = s.split(/[,:;]| is | are | refers to /);
    if (parts.length >= 2) {
      cards.push({ front: parts[0].replace(/[.!?]$/, '').trim(), back: parts.slice(1).join(' - ').trim() });
    }
  }
  if (cards.length < count) {
    sents.forEach((s) => {
      if (cards.length >= count) return;
      if (used.has(s)) return;
      used.add(s);
      const words = s.split(' ');
      const front = words.slice(0, Math.min(6, words.length)).join(' ');
      cards.push({ front, back: s });
    });
  }
  return cards;
}

function generateQuiz(text, count = 5) {
  const sents = sentences(text).filter((s) => s.split(' ').length > 6);
  const questions = [];
  const used = new Set();
  for (const s of sents) {
    if (questions.length >= count) break;
    if (used.has(s)) continue;
    used.add(s);
    const phrase = s.split(',')[0].trim().replace(/[.!?]$/, '');
    const termWords = phrase.split(' ').filter((w) => w.length > 3).slice(0, 4);
    if (termWords.length < 1) continue;
    const answer = phrase;
    const options = [answer];
    usedDistractions(sents, answer, options, 3, used);
    options.sort(() => Math.random() - 0.5);
    questions.push({
      question: `Which of the following best completes: "${s.replace(/[.!?]$/, '')}..."?`,
      options,
      answer,
    });
  }
  return questions;
}

function usedDistractions(sents, answer, options, n, used) {
  for (const s of sents) {
    if (options.length >= n + 1) break;
    const cand = s.split(',')[0].trim().replace(/[.!?]$/, '');
    if (cand && cand !== answer && !options.includes(cand) && cand.length > 5) {
      options.push(cand);
    }
  }
  while (options.length < n + 1) {
    const s = sents[options.length % sents.length];
    const cand = (s.split(' ').slice(0, 3).join(' ') || 'Option ' + options.length);
    if (!options.includes(cand)) options.push(cand);
  }
}

// RAG-style document Q&A using keyword overlap scoring over chunks.
function answerFromDocument(question, chunks) {
  if (!chunks || chunks.length === 0) return { answer: '', source: '' };
  const qWords = cleanText(question).toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
  let best = { chunk: '', score: -1 };
  for (const ch of chunks) {
    const cLower = cleanText(ch).toLowerCase();
    let score = 0;
    qWords.forEach((w) => {
      if (cLower.includes(w)) score += 1;
    });
    if (score > best.score) {
      best = { chunk: ch, score };
    }
  }
  const candidate = best.score > 0 ? best.chunk : (chunks[0] || '');
  const cw = cleanText(candidate);
  const sw = cleanText(question);
  let answer = cw;
  const qw = sw.replace(/[.?!]/g, ' ').trim();
  const idx = cw.toLowerCase().indexOf(sw.toLowerCase().slice(0, Math.min(60, sw.length)));
  if (idx !== -1) {
    answer = cw.slice(idx, idx + Math.min(400, cw.length - idx));
  }
  return { answer: answer || 'No relevant content found in the document for this question.', source: candidate.slice(0, 300) };
}

function studyPlan(subjects, days = 7) {
  const plan = [];
  for (let i = 0; i < days; i++) {
    const s = subjects[i % subjects.length] || 'Review';
    plan.push({ day: i + 1, subject: s, task: `Study ${s} for 45 minutes, then attempt practice questions.` });
  }
  return plan;
}

function generateArticleOutline(topic) {
  return [
    { heading: `Introduction to ${topic}`, points: ['Why this matters', 'Learning objectives'] },
    { heading: 'Core Concepts', points: ['Key definitions', 'Important terms'] },
    { heading: 'Detailed Explanation', points: ['Deep dive', 'Examples and analogies'] },
    { heading: 'Common Mistakes', points: ['Pitfalls to avoid'] },
    { heading: 'Practice Questions', points: ['Self-assessment'] },
    { heading: 'Conclusion', points: ['Summary and next steps' + (topic ? ` for ${topic}` : '')] },
  ];
}

function generatePost(topic) {
  const tagline = topic ? `Let's talk about ${topic} today.` : 'Here is a fresh learning insight for today.';
  return `${tagline}\n\nI have been exploring this topic and wanted to share a few key takeaways that made a real difference in my understanding. Save this for later and share it with someone revising for their exams!\n\nWhat are your thoughts? Drop them in the comments below.`;
}

function generateTags(topic) {
  const words = cleanText(topic || '').split(' ').filter((w) => w.length > 2).slice(0, 5);
  const base = words.length ? words : ['study', 'learning'];
  return ['#' + base.map((w) => w.toLowerCase()).join(' #'), '#campusai', '#studywithme', '#examprep'];
}

module.exports = {
  summarize,
  generateQuestions,
  generateFlashcards,
  generateQuiz,
  answerFromDocument,
  studyPlan,
  generateArticleOutline,
  generatePost,
  generateTags,
  sentences,
  cleanText,
};
