const config = require('../config');

let failureUntil = 0;
const COOLDOWN_MS = 5 * 60 * 1000;

const provider = () => config.llm.provider || 'ollama';

const endpoint = () => {
  if (provider() === 'openai') return 'https://api.openai.com/v1/chat/completions';
  return `${String(config.llm.ollamaUrl).replace(/\/+$/, '')}/chat/completions`;
};

const headers = () => {
  const h = { 'Content-Type': 'application/json' };
  if (provider() === 'openai') h.Authorization = `Bearer ${config.llm.openaiApiKey}`;
  return h;
};

const model = () =>
  provider() === 'openai' ? config.llm.openaiModel : config.llm.ollamaModel;

const isConfigured = () =>
  provider() === 'ollama' || Boolean(config.llm.openaiApiKey);

const isAvailable = () => isConfigured() && Date.now() > failureUntil;

const markFailure = () => {
  failureUntil = Date.now() + COOLDOWN_MS;
};

async function parseError(res) {
  const text = await res.text().catch(() => '');
  return `LLM request failed (${res.status}): ${text.slice(0, 200)}`;
}

function systemPrompt(contextText, user) {
  let prompt =
    'You are the CampusAI Study Assistant, a friendly, precise AI study partner inside a campus learning platform. ' +
    'Help students with study questions, explanations, exam prep, summaries, notes and learning plans. ' +
    "Answer clearly with markdown when helpful (headings, lists, code blocks). If you don't know something, say so rather than guess.";
  if (user && user.name) prompt += `\nThe student's name is ${user.name.split(' ')[0]}.`;
  if (contextText) prompt += `\n\nRelevant document notes from the student (use this as the primary source when answering):\n${contextText}`;
  return prompt;
}

async function chat({ systemPrompt, messages }) {
  if (!isConfigured()) throw new Error('LLM provider is not configured');
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model: model(),
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: false,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    markFailure();
    throw new Error(await parseError(res));
  }
  const json = await res.json();
  const content = (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || '';
  return String(content).trim();
}

async function streamChat({ systemPrompt, messages, signal, onContent }) {
  if (!isConfigured()) throw new Error('LLM provider is not configured');
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      model: model(),
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: true,
      temperature: 0.7,
    }),
    signal,
  });
  if (!res.ok) {
    markFailure();
    throw new Error(await parseError(res));
  }
  if (!res.body) {
    markFailure();
    throw new Error('LLM returned no response body');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
        if (delta) {
          full += delta;
          if (onContent) onContent(delta);
        }
      } catch {
        // ignore malformed chunks
      }
    }
  }
  return full.trim();
}

module.exports = { isConfigured, isAvailable, markFailure, chat, streamChat, systemPrompt, model };