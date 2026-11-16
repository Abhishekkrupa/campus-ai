import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import Avatar from '../components/Avatar';
import CommentSection from '../components/CommentSection';
import { formatNumber, timeAgo } from '../utils/format';
import '../components/ResourceCard.css';
import './Notes.css';

export default function NoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phone, setPhone] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .get(`/notes/${id}`)
      .then(({ data }) => setNote(data))
      .catch((e) => setError(errorMessage(e, 'Note not found')))
      .finally(() => setLoading(false));
  }, [id]);

  const like = async () => {
    try {
      const { data } = await api.post(`/notes/${id}/like`);
      setNote((n) => ({ ...n, liked: data.liked, likesCount: data.likesCount }));
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  const download = async () => {
    try {
      const { data } = await api.post(`/notes/${id}/download`);
      setNote((n) => ({ ...n, downloads: data.downloads }));
      if (data.url) window.open(data.url, '_blank');
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  const share = async (e) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setSharing(true);
    try {
      const { data } = await api.post(`/notes/${id}/share`, { phone: phone.trim() });
      setPhoneOpen(false);
      setPhone('');
      if (window.confirm(`Note shared with ${data.recipient.name}. Open the chat?`)) {
        navigate(`/messages?to=${data.recipient._id}`);
      }
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSharing(false);
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
  if (!note) return <div className="empty">Note not found.</div>;

  const author = note.author || {};

  return (
    <div className="page note-detail">
      <Link to="/notes" className="back-link">← Back to notes</Link>

      <div className="note-content card">
        <div className="rc-body">
          <div className="note-title-row">
            <span className="tag">📒 {note.fileType || 'Note'}</span>
            {note.subject && <span className="tag">{note.subject}</span>}
            {note.department && <span className="tag">{note.department}</span>}
          </div>
          <h1>{note.title}</h1>
          <p className="rc-desc">{note.description || 'No description provided.'}</p>
          {note.tags && note.tags.length > 0 && (
            <div className="rc-tags">
              {note.tags.map((t) => (
                <span key={t} className="tag">#{t}</span>
              ))}
            </div>
          )}
        </div>

        <div className="note-stats muted">
          ⬇ {formatNumber(note.downloads)} downloads · 👁 {formatNumber(note.views)} views · ❤{' '}
          {formatNumber(note.likesCount)} likes · {timeAgo(note.createdAt)}
        </div>

        <div className="note-actions">
          <button className={`btn ${note.liked ? '' : 'btn-outline'}`} onClick={like}>
            {note.liked ? '❤️ Liked' : '🤍 Like'}
          </button>
          {note.fileUrl ? (
            <button className="btn btn-outline" onClick={download}>⬇ Download</button>
          ) : (
            <span className="muted">No file attached</span>
          )}
          <button className="btn btn-outline" onClick={() => setPhoneOpen(!phoneOpen)}>
            📤 Share by phone
          </button>
        </div>
        {phoneOpen && (
          <form className="card share-phone-form" onSubmit={share}>
            <input
              className="input"
              placeholder="Friend's phone number (e.g. 9876543210)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button className="btn btn-sm" disabled={!phone.trim() || sharing}>
              {sharing ? <span className="spinner" /> : 'Share note'}
            </button>
          </form>
        )}
      </div>

      {author._id && (
        <div className="card note-author">
          <Avatar user={author} size={48} />
          <div className="note-author-info">
            <Link to={`/profile/${author.username}`} className="note-author-name">
              {author.name}
              {author.isVerified && <span className="badge badge-verified">✓</span>}
            </Link>
            <div className="muted">{author.department || author.bio || '@' + author.username}</div>
          </div>
        </div>
      )}

      <div className="card note-comments">
        <h3>Comments</h3>
        <CommentSection targetType="Note" targetId={note._id} />
      </div>
    </div>
  );
}