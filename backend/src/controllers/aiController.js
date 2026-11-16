const { prisma, createId, userId: reqUserId } = require('../utils/prisma');
const ai = require('../services/aiService');
const llm = require('../services/llmService');
const { extractTextFromBuffer } = require('../services/documentExtractor');
const { toInt } = require('../utils/sanitize');

const MAX_GEN_COUNT = 50;
const MAX_HISTORY_MESSAGES = 20;

const recordActivity = (userId, type, metadata = {}) => prisma.activity.create({ data: { id: createId(), user: userId, type, metadata } }).catch(() => {});

const runLLM = async ({ systemPrompt, messages, fallback }) => {
  if (llm.isAvailable()) {
    try { return await llm.chat({ systemPrompt, messages }); } catch (err) { console.error('LLM chat failed, using fallback:', err.message); }
  }
  return fallback();
};

const chat = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const { message, conversationId, noteId, stream, fileText, fileName } = req.body;
    if (!message) return res.status(400).json({ message: 'Message required' });

    let conv;
    if (conversationId) {
      conv = await prisma.aIConversation.findUnique({ where: { id: conversationId } }).catch(()=>null);
      if (!conv || String(conv.user) !== String(uid)) return res.status(404).json({ message: 'Conversation not found' });
    } else {
      conv = await prisma.aIConversation.create({ data: { id: createId(), user: uid, title: String(message).slice(0, 40), context: noteId || fileText ? 'document' : 'chat', noteId: noteId || null, messages: [] } });
    }

    let contextText = '';
    let sources = [];
    if (fileText) { contextText = String(fileText).replace(/\s+/g, ' ').trim().slice(0, 15000); if (fileName) sources.push(fileName); }
    if (noteId && !contextText) {
      const note = await prisma.note.findUnique({ where: { id: noteId } }).catch(()=>null);
      if (note && note.extractedText) { contextText = String(note.extractedText).replace(/\s+/g, ' ').trim().slice(0, 15000); sources = [note.title]; }
    }

    const userMsg = await prisma.aIMessage.create({ data: { id: createId(), conversation: conv.id, role: 'user', content: message, sources: [] } });
    const convMessages = Array.isArray(conv.messages) ? conv.messages : [];
    conv = await prisma.aIConversation.update({ where: { id: conv.id }, data: { messages: [...convMessages, userMsg.id] } });
    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (user) { const g = user.gamification || { xp: 0, level: 1, streaks: 0, badges: [] }; g.xp = (g.xp||0)+3; await prisma.user.update({ where: { id: uid }, data: { gamification: g } }).catch(()=>{}); }

    const history = await prisma.aIMessage.findMany({ where: { conversation: conv.id }, orderBy: { createdAt: 'asc' }, take: MAX_HISTORY_MESSAGES });
    const historyMessages = history.filter((m) => String(m.id) !== String(userMsg.id)).map((m) => ({ role: m.role, content: m.content }));

    const systemPrompt = llm.systemPrompt(contextText, req.user);
    const llmMessages = [...historyMessages, { role: 'user', content: message }];

    const saveReply = async (reply) => {
      const aiMsg = await prisma.aIMessage.create({ data: { id: createId(), conversation: conv.id, role: 'assistant', content: reply, sources } });
      const latest = await prisma.aIConversation.findUnique({ where: { id: conv.id } });
      const msgs = Array.isArray(latest.messages) ? latest.messages : [];
      await prisma.aIConversation.update({ where: { id: conv.id }, data: { messages: [...msgs, aiMsg.id] } });
      return aiMsg;
    };

    const localReply = () => (contextText ? `Here's what your selected document covers:\n\n${contextText.slice(0, 1500)}` : aiDialog(message, req.user));

    const streamReply = async () => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders && res.flushHeaders();
      let full = '';
      const write = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
      const abortController = new AbortController();
      req.on('close', () => abortController.abort());
      if (llm.isAvailable()) {
        try { full = await llm.streamChat({ systemPrompt, messages: llmMessages, signal: abortController.signal, onContent: (delta) => write({ content: delta }) }); }
        catch (streamErr) { console.error('OpenAI stream failed, using fallback:', streamErr.message); full = localReply(); write({ content: full }); }
      } else { full = localReply(); write({ content: full }); }
      try { await saveReply(full); } catch (saveErr) { console.error('Failed to save AI message:', saveErr.message); }
      await recordActivity(uid, 'ai_chat', { message: String(message).slice(0, 200) });
      write({ done: true, conversationId: conv.id, sources });
      res.end();
    };

    if (stream) return streamReply();
    const reply = await runLLM({ systemPrompt, messages: llmMessages, fallback: localReply });
    await saveReply(reply);
    await recordActivity(uid, 'ai_chat', { message: String(message).slice(0, 200) });
    res.json({ reply, sources, conversationId: conv.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

function aiDialog(message, user) {
  const m = String(message).toLowerCase();
  if (m.includes('summary') || m.includes('summarize')) return 'Send me a topic or text and I can summarize it using the Summarize tool.';
  return `Hi ${(user?.name||'there').split(' ')[0]} — I'm your CampusAI Study Assistant. I can help you summarize notes, generate questions, make flashcards, build quizzes, plan your study, and answer questions on your uploaded documents. Try asking about a subject like Operating Systems or Computer Networks.`;
}

const summarize = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: 'Text required' });
    if (llm.isAvailable()) {
      try {
        const reply = await llm.chat({ systemPrompt: 'You are a summarization assistant. Produce a concise summary with bullet-point key takeaways.', messages: [{ role: 'user', content: `Summarize the following text in a concise way with bullet points:\n\n${String(text).slice(0, 12000)}` }] });
        await recordActivity(uid, 'ai_summarize', { textLen: String(text).length });
        return res.json({ summary: reply, points: String(reply).split('\n').filter((l) => l.trim()) });
      } catch (err) { console.error('LLM summarize failed, using local:', err.message); }
    }
    const result = ai.summarize(text);
    await recordActivity(uid, 'ai_summarize', { textLen: String(text).length });
    res.json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const questions = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const { text, count } = req.body;
    if (!text) return res.status(400).json({ message: 'Text required' });
    const n = toInt(count, { min: 1, max: MAX_GEN_COUNT, def: 5 });
    if (llm.isAvailable()) {
      try {
        const reply = await llm.chat({ systemPrompt: 'You generate study questions. Return JSON array of objects: [{ "question": "...", "answer": "..." }]. No explanation.', messages: [{ role: 'user', content: `Generate ${n} study questions from this text. Return ONLY valid JSON:\n\n${String(text).slice(0, 12000)}` }] });
        const parsed = JSON.parse(String(reply).replace(/```json\n?/g, '').replace(/```/g, '').trim());
        if (Array.isArray(parsed) && parsed.length > 0) { await recordActivity(uid, 'ai_questions', { textLen: String(text).length, count: n }); return res.json({ questions: parsed }); }
      } catch (err) { console.error('LLM questions failed, using local:', err.message); }
    }
    res.json({ questions: ai.generateQuestions(text, n) });
    await recordActivity(uid, 'ai_questions', { textLen: String(text).length, count: n });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const flashcards = async (req, res) => { const { text, count } = req.body; if (!text) return res.status(400).json({ message: 'Text required' }); res.json({ cards: ai.generateFlashcards(text, toInt(count, { min: 1, max: MAX_GEN_COUNT, def: 6 })) }); };
const quiz = async (req, res) => { const { text, count } = req.body; if (!text) return res.status(400).json({ message: 'Text required' }); res.json({ questions: ai.generateQuiz(text, toInt(count, { min: 1, max: MAX_GEN_COUNT, def: 5 })) }); };
const studyPlan = async (req, res) => { const { subjects = [], days } = req.body; if (!subjects.length) return res.status(400).json({ message: 'Subjects required' }); res.json({ plan: ai.studyPlan(subjects, toInt(days, { min: 1, max: 90, def: 7 })) }); };

const saveFlashcards = async (req, res) => {
  try { const uid = reqUserId(req); const { title, subject, cards } = req.body; if (!cards || !cards.length) return res.status(400).json({ message: 'Cards required' }); if (!Array.isArray(cards) || cards.length > 200) return res.status(400).json({ message: 'Too many cards' }); const fc = await prisma.flashcard.create({ data: { id: createId(), owner: uid, title: title || '', subject: subject || '', cards: cards.slice(0, 200) } }); res.status(201).json({ ...fc, _id: fc.id }); }
  catch (err) { res.status(500).json({ message: err.message }); }
};
const saveQuiz = async (req, res) => {
  try { const uid = reqUserId(req); const { title, description, subject, questions } = req.body; if (!questions || !questions.length) return res.status(400).json({ message: 'Questions required' }); if (!Array.isArray(questions) || questions.length > 200) return res.status(400).json({ message: 'Too many questions' }); const q = await prisma.quiz.create({ data: { id: createId(), creator: uid, title: title || '', description: description || '', subject: subject || '', questions: questions.slice(0, 200) } }); res.status(201).json({ ...q, _id: q.id }); }
  catch (err) { res.status(500).json({ message: err.message }); }
};
const listQuizzes = async (req, res) => { try { const uid = reqUserId(req); const quizzes = await prisma.quiz.findMany({ where: { creator: uid }, orderBy: { createdAt: 'desc' }, take: 50 }); res.json(quizzes.map((q)=>({...q,_id:q.id}))); } catch (err) { res.status(500).json({ message: err.message }); } };
const conversations = async (req, res) => { try { const uid = reqUserId(req); const convs = await prisma.aIConversation.findMany({ where: { user: uid }, orderBy: { updatedAt: 'desc' }, take: 50 }); res.json(convs.map((c)=>({...c,_id:c.id}))); } catch (err) { res.status(500).json({ message: err.message }); } };
const conversationMessages = async (req, res) => { try { const uid = reqUserId(req); const conv = await prisma.aIConversation.findUnique({ where: { id: req.params.id } }).catch(()=>null); if (!conv || String(conv.user) !== String(uid)) return res.status(404).json({ message: 'Not found' }); const msgs = await prisma.aIMessage.findMany({ where: { conversation: conv.id }, orderBy: { createdAt: 'asc' }, take: 200 }); res.json(msgs.map((m)=>({...m,_id:m.id}))); } catch (err) { res.status(500).json({ message: err.message }); } };

const generatePost = (req, res) => { res.json({ content: ai.generatePost(req.body.topic || '') }); };
const generateTags = (req, res) => { res.json({ tags: ai.generateTags(req.body.topic || '') }); };
const generateOutline = (req, res) => { res.json({ outline: ai.generateArticleOutline(req.body.topic || '') }); };
const generateDescription = (req, res) => { const topic = req.body.topic || ''; res.json({ description: `In this session we dive into ${topic || 'a key topic'} with clear explanations, practical examples, and exam-focused tips. Perfect for revision and building strong fundamentals.` }); };

module.exports = { chat, summarize, questions, flashcards, quiz, studyPlan, saveFlashcards, saveQuiz, listQuizzes, conversations, conversationMessages, generatePost, generateTags, generateOutline, generateDescription };
