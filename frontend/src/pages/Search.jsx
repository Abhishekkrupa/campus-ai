import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import Avatar from '../components/Avatar';
import { formatNumber, timeAgo } from '../utils/format';
import '../components/ResourceCard.css';
import './Search.css';

function PersonRow({ u, sub }) {
  return (
    <Link to={`/profile/${u.username}`} className="search-person">
      <Avatar user={u} size={44} />
      <div>
        <div className="search-name">
          {u.name || u.username}
          {u.isVerified && <span className="badge badge-verified">✓</span>}
          {u.role === 'CREATOR' && <span className="badge badge-role">CREATOR</span>}
        </div>
        <div className="muted">{sub || u.department || u.college || u.bio || '@' + u.username}</div>
      </div>
    </Link>
  );
}

function Section({ title, children }) {
  if (!children || (Array.isArray(children) && children.length === 0)) return null;
  return (
    <div className="search-section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export default function Search() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const [data, setData] = useState(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!q) {
      setData(null);
      return;
    }
    setLoading(true);
    setError('');
    Promise.all([api.get('/recommendations/search', { params: { q } }), api.get('/users/search', { params: { q } })])
      .then(([res, userRes]) => {
        setData(res.data);
        setPeople(userRes.data);
      })
      .catch((e) => setError(errorMessage(e, 'Search failed')))
      .finally(() => setLoading(false));
  }, [q]);

  if (!q) {
    return (
      <div className="page">
        <h2 className="section-title">Search</h2>
        <div className="empty card">Type something in the search bar to find people, notes, videos and more.</div>
      </div>
    );
  }

  return (
    <div className="page search-page">
      <h2 className="section-title">Results for "{q}"</h2>

      {loading ? (
        <div className="loading"><span className="spinner" /></div>
      ) : error ? (
        <div className="error-box">{error}</div>
      ) : !data ? (
        <div className="empty">Nothing found.</div>
      ) : (
        <>
          {people.length > 0 && (
            <Section title="People">
              <div className="search-list card">
                {people.map((u) => (
                  <PersonRow key={u._id} u={u} />
                ))}
              </div>
            </Section>
          )}

          {data.creators && data.creators.length > 0 && (
            <Section title="Creators">
              <div className="search-list card">
                {data.creators.map((u) => (
                  <PersonRow key={u._id} u={u} sub={u.department || 'Creator'} />
                ))}
              </div>
            </Section>
          )}

          {data.notes && data.notes.length > 0 && (
            <Section title="Notes">
              <div className="grid grid-4">
                {data.notes.map((n) => {
                  const author = n.author || {};
                  return (
                    <Link key={n._id} to={`/notes/${n._id}`} className="card resource-card">
                      <div className="rc-body">
                        <span className="tag">📒 {n.fileType || 'Note'}</span>
                        <h3>{n.title}</h3>
                        <p className="rc-desc">{n.description || ''}</p>
                      </div>
                      <div className="rc-foot">
                        <span className="rc-author">✍️ {author.name}</span>
                        <span className="muted">⬇ {formatNumber(n.downloads)} · 👁 {formatNumber(n.views)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Section>
          )}

          {data.videos && data.videos.length > 0 && (
            <Section title="Videos">
              <div className="grid grid-4">
                {data.videos.map((v) => {
                  const creator = v.creator || {};
                  return (
                    <Link key={v._id} to={`/videos/${v._id}`} className="card resource-card">
                      <div className="rc-body">
                        <span className="tag">🎬 {v.subject || 'Video'}</span>
                        <h3>{v.title}</h3>
                        <p className="rc-desc">{v.description || ''}</p>
                      </div>
                      <div className="rc-foot">
                        <span className="muted">👁 {formatNumber(v.views)} · {timeAgo(v.createdAt)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Section>
          )}

          {data.posts && data.posts.length > 0 && (
            <Section title="Posts">
              <div className="search-list card">
                {data.posts.map((p) => {
                  const author = p.author || {};
                  return (
                    <Link key={p._id} to="/feed" className="search-post">
                      <div className="search-name">✍️ {author.name}</div>
                      <div className="search-post-content">{p.content}</div>
                      <div className="muted">❤ {formatNumber(p.likesCount)} · 💬 {formatNumber(p.commentsCount)} · 👁 {formatNumber(p.views)} · {timeAgo(p.createdAt)}</div>
                    </Link>
                  );
                })}
              </div>
            </Section>
          )}

          {data.subjects && data.subjects.length > 0 && (
            <Section title="Subjects">
              <div className="dept-chips">
                {data.subjects.map((s) => (
                  <Link key={s._id} to={`/notes?subject=${encodeURIComponent(s.name)}`} className="subject-chip">{s.name}</Link>
                ))}
              </div>
            </Section>
          )}

          {data.departments && data.departments.length > 0 && (
            <Section title="Departments">
              <div className="dept-chips">
                {data.departments.map((d) => (
                  <Link key={d._id} to={`/notes?department=${encodeURIComponent(d.name)}`} className="dept-chip">{d.name}</Link>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}