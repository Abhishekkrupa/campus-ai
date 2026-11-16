import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import { timeAgo } from '../utils/format';

function Comment({ c }) {
  const author = c.author || {};
  return (
    <div className="comment">
      <Avatar user={author} size={32} />
      <div className="comment-body">
        <div className="comment-head">
          <Link to={`/profile/${author.username}`} className="comment-name">
            {author.name}
          </Link>
          <span className="muted">{timeAgo(c.createdAt)}</span>
        </div>
        <div className="comment-text">{c.content}</div>
        {c.replies && c.replies.length > 0 && (
          <div className="comment-replies">
            {c.replies.map((r) => (
              <Comment key={r._id} c={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommentSection({ targetType, targetId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/comments', { params: { targetType, targetId } });
      setComments(data);
    } catch (e) {
      alert(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType, targetId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await api.post('/comments', { targetType, targetId, content: text });
      setText('');
      load();
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  return (
    <div className="comment-section">
      <form className="comment-form" onSubmit={submit}>
        <Avatar user={user} size={32} />
        <input
          className="input"
          placeholder="Write a comment..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn btn-sm" disabled={!text.trim()}>
          Post
        </button>
      </form>
      {loading ? (
        <div className="loading"><span className="spinner" /></div>
      ) : comments.length === 0 ? (
        <div className="empty">No comments yet. Be the first!</div>
      ) : (
        <div className="comment-list">
          {comments.map((c) => (
            <Comment key={c._id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
