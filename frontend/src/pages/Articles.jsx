import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import CommentSection from '../components/CommentSection';
import { formatNumber, timeAgo } from '../utils/format';
import '../components/ResourceCard.css';
import './Articles.css';

export default function Articles() {
  const { user } = useAuth();
  const isCreator = user && user.role === 'CREATOR';

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', subtitle: '', subject: '', tags: '', content: '' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/articles');
      setArticles(data);
    } catch (e) {
      setError(errorMessage(e, 'Could not load articles'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const open = async (id) => {
    setSelected(null);
    try {
      const { data } = await api.get(`/articles/${id}`);
      setSelected(data);
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  const like = async () => {
    try {
      const { data } = await api.post(`/articles/${selected._id}/like`);
      setSelected((a) => ({ ...a, liked: data.liked, likesCount: (a.likesCount || 0) + (data.liked ? 1 : -1) }));
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  const create = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    setSubmitting(true);
    try {
      const tags = form.tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
      await api.post('/articles', { ...form, tags });
      setShowCreate(false);
      setForm({ title: '', subtitle: '', subject: '', tags: '', content: '' });
      load();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (selected) {
    const author = selected.author || {};
    return (
      <div className="page">
        <button className="back-link btn btn-ghost btn-sm" onClick={() => setSelected(null)}>← Back to articles</button>
        <article className="card article-reader">
          <div className="article-hero">
            <div className="article-hero-tags">
              {selected.subject && <span className="tag">{selected.subject}</span>}
              {selected.readingTime && <span className="tag">📖 {selected.readingTime} min read</span>}
            </div>
            <h1>{selected.title}</h1>
            {selected.subtitle && <p className="article-sub">{selected.subtitle}</p>}
            <div className="article-hero-meta muted">
              {author._id && (
                <Link to={`/profile/${author.username}`} className="article-author">
                  <Avatar user={author} size={24} />
                  <span>{author.name}</span>
                </Link>
              )}
              <span>{timeAgo(selected.createdAt)} · 👁 {formatNumber(selected.views)} · ❤ {formatNumber(selected.likesCount)}</span>
            </div>
          </div>
          {selected.cover && <img className="article-cover" src={selected.cover} alt="" />}
          <div className="article-body">{selected.content}</div>
          <div className="article-actions">
            <button className={`btn ${selected.liked ? '' : 'btn-outline'}`} onClick={like}>
              {selected.liked ? '❤️ Liked' : '🤍 Like'}
            </button>
          </div>
          <div className="article-comments">
            <h3>Comments</h3>
            <CommentSection targetType="Article" targetId={selected._id} />
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="notes-head">
        <div>
          <h2 className="section-title">Articles</h2>
          <div className="muted">{articles.length} published articles</div>
        </div>
        {isCreator && (
          <button className="btn" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? '✕ Close' : '✍ Write article'}
          </button>
        )}
      </div>

      {showCreate && (
        <form className="card notes-upload" onSubmit={create}>
          <h3>Write an article</h3>
          <div className="form-row">
            <label className="label">Title*</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="grid grid-2">
            <div className="form-row">
              <label className="label">Subtitle</label>
              <input className="input" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
            </div>
            <div className="form-row">
              <label className="label">Subject</label>
              <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <label className="label">Content*</label>
            <textarea className="textarea" style={{ minHeight: 200 }} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required />
          </div>
          <div className="form-row">
            <label className="label">Tags (comma separated)</label>
            <input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </div>
          <button className="btn" disabled={!form.title.trim() || !form.content.trim() || submitting}>
            {submitting ? <span className="spinner" /> : 'Publish'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="loading"><span className="spinner" /></div>
      ) : error ? (
        <div className="error-box">{error}</div>
      ) : articles.length === 0 ? (
        <div className="empty card">No articles yet{isCreator ? '. Write the first one!' : '.'}</div>
      ) : (
        <div className="article-list">
          {articles.map((a) => {
            const author = a.author || {};
            return (
              <button key={a._id} className="card article-row" onClick={() => open(a._id)}>
                <div className="article-row-main">
                  <div className="article-row-tags">
                    <span className="tag">📖 {a.readingTime || 1} min read</span>
                    {a.subject && <span className="tag">{a.subject}</span>}
                  </div>
                  <h3>{a.title}</h3>
                  <p className="rc-desc">{a.subtitle || (a.content || '').slice(0, 140)}</p>
                </div>
                <div className="rc-foot">
                  <div className="rc-author">
                    <Avatar user={author} size={24} />
                    <span>{author.name}</span>
                  </div>
                  <span className="muted">👁 {formatNumber(a.views)} · ❤ {formatNumber(a.likesCount)} · {timeAgo(a.createdAt)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}