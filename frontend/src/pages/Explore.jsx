import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { NoteCard, VideoCard, ArticleCard, CreatorCard } from '../components/ResourceCard';
import './Explore.css';

function Section({ title, children, linkTo, linkLabel }) {
  return (
    <div className="explore-section">
      <div className="explore-sec-head">
        <h3>{title}</h3>
        {linkTo && <Link to={linkTo} className="explore-more">{linkLabel || 'See all'}</Link>}
      </div>
      {children}
    </div>
  );
}

export default function Explore() {
  const [data, setData] = useState(null);
  const [recs, setRecs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/recommendations/explore'),
      api.get('/recommendations/me'),
    ])
      .then(([exploreRes, recRes]) => {
        setData(exploreRes.data);
        setRecs(recRes.data);
      })
      .catch((e) => setError(e?.response?.data?.message || 'Failed to load explore'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <span className="spinner" />
      </div>
    );
  }
  if (error) return <div className="error-box">{error}</div>;
  if (!data) return <div className="empty">Nothing to explore yet.</div>;

  return (
    <div className="explore">
      <h2 className="section-title">Explore</h2>

      {data.departments && data.departments.length > 0 && (
        <Section title="Departments">
          <div className="dept-chips">
            {data.departments.map((d) => (
              <Link to={`/notes?department=${encodeURIComponent(d.name)}`} key={d._id} className="dept-chip">
                <span className="dept-dot" style={{ background: d.color || '#7c5cff' }} />
                {d.name}
              </Link>
            ))}
          </div>
        </Section>
      )}

      {data.subjects && data.subjects.length > 0 && (
        <Section title="Popular subjects">
          <div className="dept-chips">
            {data.subjects.map((s) => (
              <Link to={`/notes?subject=${encodeURIComponent(s.name)}`} key={s._id} className="subject-chip">
                {s.name}
              </Link>
            ))}
          </div>
        </Section>
      )}

      {recs && recs.posts && recs.posts.length > 0 && (
        <Section title="✨ Recommended for you" linkTo="/feed" linkLabel="View feed">
          <div className="rec-row">
            {recs.posts.slice(0, 4).map((p) => (
              <div key={p.id} className="card resource-card">
                <div className="rc-body">
                  <span className="tag">📝 {p.subject || 'Post'}</span>
                  <h3 style={{ fontSize: 14 }}>({p.title || 'post'})</h3>
                  <div className="rc-tags">
                    {(p.tags || []).slice(0, 3).map((t) => (
                      <span key={t} className="tag">#{t}</span>
                    ))}
                  </div>
                </div>
                <div className="rc-foot">
                  <span className="muted">Scored {Math.round((p.score || 0) * 100)}% match</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.trendingNotes && data.trendingNotes.length > 0 && (
        <Section title="🔥 Trending notes" linkTo="/notes">
          <div className="rec-row">
            {data.trendingNotes.map((n) => (
              <NoteCard key={n._id} note={n} />
            ))}
          </div>
        </Section>
      )}

      {data.popularVideos && data.popularVideos.length > 0 && (
        <Section title="🎬 Popular videos" linkTo="/videos">
          <div className="rec-row">
            {data.popularVideos.map((v) => (
              <VideoCard key={v._id} video={v} />
            ))}
          </div>
        </Section>
      )}

      {data.latestNotes && data.latestNotes.length > 0 && (
        <Section title="🕒 Latest notes">
          <div className="rec-row">
            {data.latestNotes.map((n) => (
              <NoteCard key={n._id} note={n} />
            ))}
          </div>
        </Section>
      )}

      {data.creators && data.creators.length > 0 && (
        <Section title="👨‍🏫 Top creators">
          <div className="rec-row-4">
            {data.creators.slice(0, 4).map((c) => (
              <CreatorCard key={c._id || c.user?._id} creator={c} />
            ))}
          </div>
        </Section>
      )}

      {data.trendingPosts && data.trendingPosts.length > 0 && (
        <Section title="🚀 Trending discussions" linkTo="/feed">
          <div className="rec-row">
            {data.trendingPosts.map((p) => (
              <div key={p._id} className="card resource-card">
                <div className="rc-body">
                  <h3 style={{ fontSize: 14 }}>{p.content}</h3>
                  <div className="rc-tags">
                    {(p.tags || []).slice(0, 3).map((t) => (
                      <span key={t} className="tag">#{t}</span>
                    ))}
                  </div>
                </div>
                <div className="rc-foot">
                  <span className="muted">
                    ✍️ {p.author?.name} · 👁 {p.views} · ❤ {p.likesCount}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
