import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import Avatar from '../components/Avatar';
import { formatNumber } from '../utils/format';
import './Creator.css';

function Metric({ icon, label, value }) {
  return (
    <div className="card metric">
      <div className="metric-icon">{icon}</div>
      <div>
        <div className="metric-value">{value}</div>
        <div className="muted">{label}</div>
      </div>
    </div>
  );
}

function BarChart({ series, color }) {
  if (!series || series.length === 0) return <div className="empty">Not enough data yet.</div>;
  const max = Math.max(...series.map((s) => s.value), 1);
  return (
    <div className="bar-chart">
      {series.map((s) => (
        <div key={s.date} className="bar-col" title={`${s.date}: ${s.value}`}>
          <div className="bar-fill" style={{ height: `${Math.max(4, (s.value / max) * 100)}%`, background: color || 'var(--primary)' }} />
          <span className="bar-label muted">{s.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export default function CreatorDashboard() {
  const [tab, setTab] = useState('overview');
  const [dash, setDash] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [content, setContent] = useState(null);
  const [audience, setAudience] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [range, setRange] = useState('7');
  const [aiTopic, setAiTopic] = useState('');
  const [gen, setGen] = useState(null);
  const [genLoading, setGenLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [a, b, c, d] = await Promise.all([
        api.get('/creator/dashboard'),
        api.get('/creator/analytics', { params: { range } }),
        api.get('/creator/content'),
        api.get('/creator/audience'),
      ]);
      setDash(a.data);
      setAnalytics(b.data);
      setContent(c.data);
      setAudience(d.data);
    } catch (e) {
      setError(errorMessage(e, 'Creator dashboard unavailable'));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const genAI = async (which) => {
    if (!aiTopic.trim()) return;
    setGenLoading(true);
    setGen(null);
    try {
      const { data } = await api.post(`/ai/generate/${which}`, { topic: aiTopic });
      setGen({ which, ...data });
    } catch (e) {
      alert(errorMessage(e));
    } finally {
      setGenLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <span className="spinner" />
      </div>
    );
  }
  if (error) return <div className="error-box">{error}</div>;

  const m = dash?.metrics || {};

  const tabs = ['overview', 'analytics', 'content', 'audience', 'ai-tools'].map((v) => ({
    v,
    l: { overview: '📊 Overview', analytics: '📈 Analytics', content: '📦 Content', audience: '👥 Audience', 'ai-tools': '🤖 AI tools' }[v],
  }));

  return (
    <div className="page">
      <h2 className="section-title">Creator Studio</h2>

      <div className="feed-tabs">
        {tabs.map((t) => (
          <button key={t.v} className={`compose-tab ${tab === t.v ? 'active' : ''}`} onClick={() => setTab(t.v)}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="metric-grid">
          <Metric icon="👥" label="Followers" value={formatNumber(m.followers)} />
          <Metric icon="🖼️" label="Content" value={formatNumber(m.totalContent)} />
          <Metric icon="👁" label="Profile views" value={formatNumber(m.views)} />
          <Metric icon="⬇" label="Downloads" value={formatNumber(m.downloads)} />
          <Metric icon="✍️" label="Posts" value={formatNumber(m.posts)} />
          <Metric icon="🎬" label="Videos" value={formatNumber(m.videos)} />
          <Metric icon="📒" label="Notes" value={formatNumber(m.notes)} />
          <Metric icon="📰" label="Articles" value={formatNumber(m.articles)} />
          <div className="card metric metric-wide">
            <div className="metric-icon">💬</div>
            <div>
              <div className="metric-value">{formatNumber(m.comments)}</div>
              <div className="muted">Comments on your content</div>
            </div>
          </div>
        </div>
      )}

      {tab === 'analytics' && analytics && (
        <div className="analytics">
          <div className="analytics-head">
            <div className="feed-tabs" style={{ margin: 0 }}>
              {['7', '30'].map((r) => (
                <button key={r} className={`compose-tab ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
                  Last {r} days
                </button>
              ))}
            </div>
            <div className="muted">
              {formatNumber(analytics.totals?.posts)} posts · {formatNumber(analytics.totals?.videos)} videos ·{' '}
              {formatNumber(analytics.totals?.notes)} notes · 🧨 {formatNumber(analytics.reports)} reports
            </div>
          </div>

          <div className="card chart-card">
            <h4>Content created</h4>
            <BarChart series={analytics.viewsSeries} />
          </div>
          <div className="card chart-card">
            <h4>Note downloads</h4>
            <BarChart series={analytics.downloadsSeries} color="#16a34a" />
          </div>

          {analytics.topContent && analytics.topContent.length > 0 && (
            <div className="card chart-card">
              <h4>Top content</h4>
              <div className="top-list">
                {analytics.topContent.map((t, i) => (
                  <div key={i} className="top-item">
                    <span className="tag">{t.type}</span>
                    <span className="top-title">{t.title}</span>
                    <span className="muted">👁 {formatNumber(t.views)} · ❤ {formatNumber(t.likes)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'content' && content && (
        <div className="content-grid">
          {[
            { label: 'Posts', items: content.posts, get: (p) => ({ title: p.content || 'Post', sub: `👁 ${p.views} · ❤ ${p.likesCount}`, link: '/feed' }) },
            { label: 'Videos', items: content.videos, get: (v) => ({ title: v.title, sub: `👁 ${v.views} · ❤ ${v.likesCount}`, link: `/videos/${v._id}` }) },
            { label: 'Notes', items: content.notes, get: (n) => ({ title: n.title, sub: `👁 ${n.views} · ⬇ ${n.downloads}`, link: `/notes/${n._id}` }) },
            { label: 'Articles', items: content.articles, get: (a) => ({ title: a.title, sub: `👁 ${a.views}`, link: '/articles' }) },
          ].map((s) => (
            <div key={s.label} className="card content-block">
              <h4>{s.label} ({s.items?.length || 0})</h4>
              {!s.items || s.items.length === 0 ? (
                <div className="empty">None yet</div>
              ) : (
                <div className="content-list">
                  {s.items.slice(0, 8).map((it) => {
                    const d = s.get(it);
                    return (
                      <Link key={it._id} to={d.link} className="content-item">
                        <span className="content-title">{d.title}</span>
                        <span className="muted">{d.sub}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'audience' && audience && (
        <div className="audience">
          <div className="card audience-total">
            <span className="muted">Total followers</span>
            <div className="audience-big">{formatNumber(audience.total)}</div>
          </div>
          <div className="card chart-card">
            <h4>By department</h4>
            {audience.departments && audience.departments.length > 0 ? (
              <div className="bar-chart">
                {audience.departments.map((d, i) => (
                  <div key={d.name} className="bar-col" title={`${d.name}: ${d.value}`}>
                    <div className="bar-fill" style={{ height: `${Math.max(4, (d.value / Math.max(1, ...audience.departments.map((x) => x.value))) * 100)}%` }} />
                    <span className="bar-label muted">{d.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">No department data</div>
            )}
          </div>
          {audience.interests && audience.interests.length > 0 && (
            <div className="card chart-card">
              <h4>Interests</h4>
              <div className="dept-chips">
                {audience.interests.map((i) => (
                  <span key={i.name} className="subject-chip">{i.name} · {i.value}</span>
                ))}
              </div>
            </div>
          )}
          {audience.recent && audience.recent.length > 0 && (
            <div className="card chart-card">
              <h4>Recent followers</h4>
              <div className="conn-list">
                {audience.recent.map((u) => (
                  <Link key={u._id} to={`/profile/${u.username}`} className="conn-card">
                    <Avatar user={u} size={40} />
                    <div>
                      <div className="conn-name">{u.name}</div>
                      <div className="muted">{u.department || u.college}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'ai-tools' && (
        <div className="card chart-card ai-tools">
          <h4>AI content assistant</h4>
          <div className="form-row">
            <label className="label">Topic / keyword</label>
            <input className="input" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="e.g. Operating Systems scheduling" />
          </div>
          <div className="ai-tool-actions">
            {[
              { k: 'post', l: '✍ Generate post' },
              { k: 'tags', l: '# Generate tags' },
              { k: 'outline', l: '🗂 Generate outline' },
              { k: 'description', l: '🎬 Video description' },
            ].map((b) => (
              <button key={b.k} className="btn btn-outline" disabled={!aiTopic.trim() || genLoading} onClick={() => genAI(b.k)}>
                {b.l}
              </button>
            ))}
          </div>
          {gen && (
            <div className="gen-result">
              {gen.which === 'tags' ? (
                <p>{gen.tags || []}</p>
              ) : gen.which === 'outline' ? (
                <div>
                  {gen.outline && gen.outline.map((o, i) => (
                    <div key={i} className="plan-day">
                      <h4>{o.heading}</h4>
                      {(o.points || []).map((pt, j) => (
                        <div key={j} className="plan-task">• {pt}</div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : gen.which === 'description' ? (
                <p>{gen.description}</p>
              ) : (
                <pre>{gen.content || ''}</pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}