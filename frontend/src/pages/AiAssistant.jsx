import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';
import './AiAssistant.css';

const tools = [
  { k: 'chat', label: '💬 Chat' },
  { k: 'summarize', label: '📝 Summarize' },
  { k: 'questions', label: '❓ Questions' },
  { k: 'flashcards', label: '🃏 Flashcards' },
  { k: 'quiz', label: '📊 Quiz' },
  { k: 'study', label: '🗓️ Study plan' },
];

function FlashcardDeck({ cards }) {
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [known, setKnown] = useState([]);
  const [unknown, setUnknown] = useState([]);
  if (!cards.length) return null;
  const card = cards[i];
  const mark = (ok) => {
    (ok ? known : unknown).push(card);
    if (i + 1 < cards.length) {
      setI(i + 1);
      setFlip(false);
    } else {
      setI(-1);
    }
  };
  if (i === -1) {
    return (
      <div className="tool-result">
        <h4>Done!</h4>
        <p>✅ {known.length} known · 🔁 {unknown.length} to review</p>
        <button className="btn btn-sm btn-outline" onClick={() => { setI(0); setFlip(false); setKnown([]); setUnknown([]); }}>
          Restart
        </button>
      </div>
    );
  }
  return (
    <div className="tool-result">
      <div className="flashcard-count muted">{i + 1} / {cards.length}</div>
<button className={`flashcard ${flip ? 'flipped' : ''}`} onClick={() => setFlip(!flip)}>
            <div className="flashcard-inner">
              <div className="flashcard-face flashcard-front">{card.front || card.question}</div>
              <div className="flashcard-face flashcard-back">{card.back || card.answer}</div>
            </div>
          </button>
      <div className="flashcard-actions">
        <button className="btn btn-outline" onClick={() => mark(false)}>🔁 Review again</button>
        <button className="btn" onClick={() => mark(true)}>✅ Got it</button>
      </div>
    </div>
  );
}

function QuizRunner({ questions }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [done, setDone] = useState(false);
  if (!questions.length) return null;
  if (done) {
    const correct = questions.reduce((acc, q, i) => acc + (answers[i] === (q.correct || q.answer) ? 1 : 0), 0);
    const pct = Math.round((correct / questions.length) * 100);
    return (
      <div className="tool-result">
        <h4>Score: {correct}/{questions.length} ({pct}%)</h4>
        <div className="quiz-review">
          {questions.map((q, i) => (
            <div key={i} className="quiz-review-item">
              <div>{q.question}</div>
              <div className="muted">
                Your answer: <strong>{answers[i]}</strong> · Correct: <strong>{q.correct || q.answer}</strong>
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn-sm btn-outline" onClick={() => { setIdx(0); setAnswers({}); setDone(false); }}>
          Restart
        </button>
      </div>
    );
  }
  const q = questions[idx];
  const options = q.options || q.choices || [];
  const choose = (opt) => {
    const next = { ...answers, [idx]: opt };
    setAnswers(next);
    if (idx + 1 < questions.length) setIdx(idx + 1);
    else setDone(true);
  };
  return (
    <div className="tool-result">
      <div className="flashcard-count muted">Question {idx + 1} of {questions.length}</div>
      <div className="quiz-question">{q.question}</div>
      <div className="quiz-options">
        {options.map((opt) => (
          <button key={opt} className="btn btn-outline" onClick={() => choose(opt)}>{opt}</button>
        ))}
      </div>
    </div>
  );
}

export default function AiAssistant() {
  const [tab, setTab] = useState('chat');
  const [convs, setConvs] = useState([]);
  const [convId, setConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [loading, setLoading] = useState(false);

  const [text, setText] = useState('');
  const [count, setCount] = useState(5);
  const [result, setResult] = useState(null);
  const [toolLoading, setToolLoading] = useState(false);

  const [subjectsInput, setSubjectsInput] = useState('');
  const [days, setDays] = useState(7);
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    api
      .get('/ai/conversations')
      .then(({ data }) => setConvs(data))
      .catch(() => {});
  }, []);

  const openConv = async (id) => {
    setConvId(id);
    try {
      const { data } = await api.get(`/ai/conversations/${id}`);
      setMessages(data);
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  const sendChat = async (e) => {
    e.preventDefault();
    if (!chatText.trim() || loading) return;
    const body = { message: chatText, conversationId: convId || undefined, stream: true };
    setChatText('');
    setLoading(true);

    const userTempId = `u-${Date.now()}`;
    const aiTempId = `a-${Date.now()}`;
    setMessages((m) => [...m, { _id: userTempId, role: 'user', content: body.message }]);
    setMessages((m) => [...m, { _id: aiTempId, role: 'assistant', content: '' }]);

    let full = '';
    let newConvId = null;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok || !res.body) {
        let msg = 'Assistant request failed';
        try {
          const err = await res.json();
          if (err && err.message) msg = err.message;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) {
          const line = part.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.done) {
              newConvId = evt.conversationId || newConvId;
              setMessages((m) =>
                m.map((x) => (x._id === aiTempId ? { ...x, content: full, sources: evt.sources || x.sources } : x))
              );
              continue;
            }
            if (evt.content) {
              full += evt.content;
              setMessages((m) => m.map((x) => (x._id === aiTempId ? { ...x, content: full } : x)));
            }
          } catch {
            /* ignore malformed events */
          }
        }
      }

      if (newConvId) setConvId(newConvId);
      const { data: list } = await api.get('/ai/conversations');
      setConvs(list);
    } catch (err) {
      alert(err.message || errorMessage(err));
      setMessages((m) => m.filter((x) => x._id !== aiTempId));
    } finally {
      setLoading(false);
    }
  };

  const runTool = async (endpoint, payload) => {
    setToolLoading(true);
    setResult(null);
    try {
      const { data } = await api.post(endpoint, payload);
      setResult(data);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setToolLoading(false);
    }
  };

  return (
    <div className="page ai-page">
      <h2 className="section-title">🤖 AI Study Assistant</h2>

      <div className="feed-tabs">
        {tools.map((t) => (
          <button key={t.k} className={`compose-tab ${tab === t.k ? 'active' : ''}`} onClick={() => setTab(t.k)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'chat' && (
        <div className="ai-chat">
          <aside className="card ai-convs">
            <h4>History</h4>
            {convs.length === 0 ? (
              <div className="muted">No conversations yet.</div>
            ) : (
              convs.map((c) => (
                <button key={c._id} className={`ai-conv ${convId === c._id ? 'active' : ''}`} onClick={() => openConv(c._id)}>
                  {c.title}
                </button>
              ))
            )}
          </aside>
          <div className="card ai-chat-main">
            <div className="ai-msgs">
              {messages.length === 0 ? (
                <div className="empty">
                  Hi! I'm your CampusAI Study Assistant. Ask me anything about studying, summarising your notes, or planning your revision.
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m._id} className={`ai-msg ${m.role}`}>
                    {m.content.split('\n').map((l, i) => (
                      <p key={i}>{l}</p>
                    ))}
                    {m.sources && m.sources.length > 0 && (
                      <div className="ai-sources muted">Source: {m.sources.join(', ')}</div>
                    )}
                  </div>
                ))
              )}
              {loading && <div className="ai-msg assistant">Thinking<span className="dots"></span></div>}
            </div>
            <form className="ai-input" onSubmit={sendChat}>
              <input className="input" value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Ask the assistant..." />
              <button className="btn" disabled={!chatText.trim() || loading}>Send</button>
            </form>
          </div>
        </div>
      )}

      {tab !== 'chat' && (
        <div className="card ai-tool">
          <div className="ai-tool-inputs">
            {tab === 'study' ? (
              <>
                <div className="form-row">
                  <label className="label">Subjects (comma separated)</label>
                  <input className="input" value={subjectsInput} onChange={(e) => setSubjectsInput(e.target.value)} placeholder="e.g. OS, CN, DBMS" />
                </div>
                <div className="form-row">
                  <label className="label">Days ({days})</label>
                  <input type="range" min={1} max={30} value={days} onChange={(e) => setDays(+e.target.value)} style={{ width: '100%' }} />
                </div>
                <button className="btn" disabled={!subjectsInput.trim() || toolLoading} onClick={() => runTool('/ai/study-plan', { subjects: subjectsInput.split(',').map((s) => s.trim()).filter(Boolean), days })}>
                  {toolLoading ? <span className="spinner" /> : 'Generate plan'}
                </button>
              </>
            ) : (
              <>
                <div className="form-row">
                  <label className="label">
                    {tab === 'summarize' ? 'Paste text to summarize' : tab === 'questions' ? 'Paste text for questions' : tab === 'flashcards' ? 'Paste text for flashcards' : 'Paste text for a quiz'}
                  </label>
                  <textarea className="textarea" style={{ minHeight: 120 }} value={text} onChange={(e) => setText(e.target.value)} />
                </div>
                <div className="ai-tool-actions">
                  <button className={`btn ${tab === 'flashcards' || tab === 'quiz' ? 'btn-outline' : ''}`} disabled={!text.trim() || toolLoading} onClick={() => runTool(`/ai/${tab}`, { text, count })}>
                    {toolLoading ? <span className="spinner" /> : 'Generate'}
                  </button>
                  {(tab === 'flashcards' || tab === 'quiz') && (
                    <button className="btn btn-ghost" disabled={!text.trim() || toolLoading} onClick={() => runTool(`/ai/${tab}`, { text, count: 8 })}>
                      More
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="ai-tool-result">
            {tab === 'summarize' && result && (
              <div className="tool-result">{result.summary || result.text || JSON.stringify(result)}</div>
            )}
            {tab === 'questions' && result && (
              <div className="tool-result qa-list">
                {(result.questions || []).map((q, i) => (
                  <div key={i} className="qa-item">Q{i + 1}. {typeof q === 'string' ? q : q.question}</div>
                ))}
              </div>
            )}
            {tab === 'flashcards' && result && <FlashcardDeck cards={result.cards || []} />}
            {tab === 'quiz' && result && <QuizRunner questions={result.questions || []} />}
            {tab === 'study' && plan && (
              <div className="tool-result">
                {(plan.plan || plan).map((scope, i) => (
                  <div key={i} className="plan-day">
                    <h4>Day {scope.day || i + 1} — {scope.subject || 'Study'}</h4>
                    <div className="plan-task">• {scope.task || scope.topic || ''}</div>
                  </div>
                ))}
              </div>
            )}
            {tab !== 'study' && toolLoading && <div className="loading"><span className="spinner" /></div>}
          </div>
        </div>
      )}
    </div>
  );
}