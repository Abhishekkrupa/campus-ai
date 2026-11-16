import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import PostCard from '../components/PostCard';
import '../components/Feed.css';

const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|avi)$/i;
const IMAGE_MAX = 8 * 1024 * 1024;
const VIDEO_MAX = 200 * 1024 * 1024;

const isVideoFile = (file) =>
  file.type.startsWith('video/') || VIDEO_EXT.test(file.name);
const isImageFile = (file) =>
  file.type.startsWith('image/') || IMAGE_EXT.test(file.name);

function WhoToFollow() {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    api
      .get('/recommendations/users')
      .then(({ data }) => setUsers(Array.isArray(data) ? data.slice(0, 5) : []))
      .catch(() => {});
  }, []);

  const follow = async (id) => {
    try {
      await api.post(`/users/${id}/follow`);
      setUsers((prev) => prev.filter((u) => u._id !== id));
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  if (!users.length) return null;
  return (
    <div className="card side-card">
      <h3>Who to follow</h3>
      {users.map((u) => (
        <div key={u._id} className="who-card">
          <Avatar user={u} size={38} />
          <div className="who-info">
            <Link to={`/profile/${u.username}`} className="who-name">
              {u.name}
            </Link>
            <div className="who-sub">{u.department || u.bio || '@' + u.username}</div>
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => follow(u._id)}>
            Follow
          </button>
        </div>
      ))}
    </div>
  );
}

export default function Feed() {
  const { user } = useAuth();
  const [tab, setTab] = useState('trending');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [compose, setCompose] = useState({ content: '', type: 'text', subject: '', department: '' });
  const [tagsText, setTagsText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } =
        tab === 'trending'
          ? await api.get('/posts/trending')
          : tab === 'following'
          ? await api.get('/posts/following')
          : await api.get('/posts');
      setPosts(data);
    } catch (e) {
      setError(errorMessage(e, 'Could not load feed'));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const createPost = async (e) => {
    e.preventDefault();
    if ((!compose.content.trim() && !mediaFile) || uploading) return;
    setSubmitting(true);
    try {
      const tags = tagsText
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);
      let type = compose.type;
      let media = [];
      if (mediaFile) {
        setUploading(true);
        const fd = new FormData();
        fd.append('file', mediaFile);
        const { data } = await api.post('/upload/post-media', fd);
        media = [data.url];
        type = isVideoFile(mediaFile) ? 'video' : 'image';
      }
      await api.post('/posts', { ...compose, type, media, tags });
      resetComposer();
      load();
    } catch (e) {
      alert(errorMessage(e));
    } finally {
      setUploading(false);
      setSubmitting(false);
    }
  };

  const resetComposer = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview('');
    setMediaFile(null);
    setCompose({ content: '', type: 'text', subject: '', department: '' });
    setTagsText('');
  };

  const selectType = (t) => {
    if (t !== 'image' && t !== 'video') {
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
      setMediaPreview('');
      setMediaFile(null);
    }
    setCompose({ ...compose, type: t });
    if (t === 'image' || t === 'video') {
      setTimeout(() => fileRef.current && fileRef.current.click(), 0);
    }
  };

  const attachFile = (file) => {
    if (!file) return;
    if (!isImageFile(file) && !isVideoFile(file)) {
      alert('Please choose an image (jpg, png, gif, webp) or video (mp4, webm, mov, avi)');
      return;
    }
    const isVideo = isVideoFile(file);
    if (isVideo && file.size > VIDEO_MAX) {
      alert('Video too large. Max size is 200MB.');
      return;
    }
    if (!isVideo && file.size > IMAGE_MAX) {
      alert('Image too large. Max size is 8MB.');
      return;
    }
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setCompose({ ...compose, type: isVideo ? 'video' : 'image' });
  };

  const removeMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview('');
    setMediaFile(null);
    setCompose({ ...compose, type: 'text' });
  };

  const removeFromList = (id) => setPosts((prev) => prev.filter((p) => p._id !== id));

  return (
    <div className="feed-layout">
      <div className="feed-main">
        <h2 className="section-title">Home feed</h2>

        <div className="card compose">
          <div className="compose-tabs">
            {[
              { v: 'text', l: '📝 Text' },
              { v: 'image', l: '📷 Photo' },
              { v: 'video', l: '🎥 Video' },
              { v: 'question', l: '❓ Question' },
              { v: 'announcement', l: '📣 Announcement' },
            ].map((t) => (
              <button
                key={t.v}
                type="button"
                className={`compose-tab ${compose.type === t.v ? 'active' : ''}`}
                onClick={() => selectType(t.v)}
              >
                {t.l}
              </button>
            ))}
          </div>
          <form onSubmit={createPost}>
            <div className="compose-head">
              <Avatar user={user} size={40} />
              <textarea
                className="textarea"
                placeholder={`What's on your mind${user ? ', ' + user.name.split(' ')[0] : ''}?`}
                value={compose.content}
                onChange={(e) => setCompose({ ...compose, content: e.target.value })}
              />
            </div>
            {(compose.type === 'image' || compose.type === 'video') && (
              <div className="compose-media">
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  accept={compose.type === 'video' ? 'video/mp4,video/webm,video/quicktime,video/x-msvideo' : 'image/jpeg,image/png,image/gif,image/webp'}
                  onChange={(e) => {
                    attachFile(e.target.files[0]);
                    e.target.value = '';
                  }}
                />
                {!mediaPreview ? (
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={uploading}
                    onClick={() => fileRef.current && fileRef.current.click()}
                  >
                    {compose.type === 'video' ? '🎥 Add video' : '📷 Add image'}
                  </button>
                ) : (
                  <div className="media-preview">
                    {compose.type === 'video' ? (
                      <video src={mediaPreview} controls className="post-img" />
                    ) : (
                      <img src={mediaPreview} alt="preview" className="post-img" />
                    )}
                    <button type="button" className="btn btn-danger btn-sm" onClick={removeMedia} disabled={uploading}>
                      Remove
                    </button>
                  </div>
                )}
                {uploading && <div className="muted">Uploading...</div>}
              </div>
            )}
            <div className="compose-tags">
              <input
                className="input"
                placeholder="Tags (comma separated)"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="btn" disabled={(!compose.content.trim() && !mediaFile) || submitting || uploading}>
                {submitting ? <span className="spinner" /> : 'Post'}
              </button>
            </div>
          </form>
        </div>

        <div className="feed-tabs">
          {[
            { v: 'trending', l: '🔥 Trending' },
            { v: 'latest', l: '🕒 Latest' },
            { v: 'following', l: '👥 Following' },
          ].map((t) => (
            <button
              key={t.v}
              className={`compose-tab ${tab === t.v ? 'active' : ''}`}
              onClick={() => setTab(t.v)}
            >
              {t.l}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading">
            <span className="spinner" />
          </div>
        ) : error ? (
          <div className="error-box">{error}</div>
        ) : posts.length === 0 ? (
          <div className="empty card">No posts here yet. Follow people or create your first post!</div>
        ) : (
          posts.map((p) => (
            <PostCard key={p._id} post={p} onDeleted={removeFromList} />
          ))
        )}
      </div>

      <div className="feed-side">
        <WhoToFollow />
      </div>
    </div>
  );
}
