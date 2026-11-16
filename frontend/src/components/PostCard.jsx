import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import { formatNumber, timeAgo } from '../utils/format';
import CommentSection from './CommentSection';
import './Feed.css';

export default function PostCard({ post: initial, onDeleted }) {
  const { user } = useAuth();
  const [post, setPost] = useState(initial);
  const [showComments, setShowComments] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggleLike = async () => {
    try {
      const { data } = await api.post(`/posts/${post._id}/like`);
      setPost({ ...post, liked: data.liked, likesCount: data.likesCount });
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  const toggleSave = async () => {
    try {
      const { data } = await api.post(`/posts/${post._id}/save`);
      setPost({ ...post, saved: data.saved });
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  const share = async () => {
    try {
      await api.post(`/posts/${post._id}/share`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await api.delete(`/posts/${post._id}`);
      if (onDeleted) onDeleted(post._id);
      setPost(null);
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  if (!post) return null;
  const author = post.author || {};

  const canModerate = user && (user.role === 'SUPER_ADMIN' || user.role === 'MODERATOR');
  const isOwner = author._id === user?._id;

  return (
    <article className="card post-card">
      <div className="post-head">
        <Link to={`/profile/${author.username}`}>
          <Avatar user={author} size={44} />
        </Link>
        <div className="post-meta">
          <div className="post-author">
            <Link to={`/profile/${author.username}`}>{author.name}</Link>
            {author.isVerified && (
              <span className="badge badge-verified" title="Verified">
                ✓
              </span>
            )}
            {author.role === 'CREATOR' && <span className="badge badge-role">{author.role}</span>}
          </div>
          <div className="post-sub">
            {[author.department, author.bio && author.college].filter(Boolean).map((t) => t).slice(0, 1)}
            {author.department ? ` ${author.department} · ` : ''}
            {timeAgo(post.createdAt)}
          </div>
        </div>
        {(isOwner || canModerate) && (
          <button className="btn btn-ghost btn-sm" onClick={remove}>
            🗑
          </button>
        )}
      </div>

      <div className="post-body">
        {post.content}
        {post.media && post.media.length > 0 && (
          <div className="post-media">
            {post.media.map((m, i) =>
              /\.(png|jpe?g|gif|webp)$/i.test(m) ? (
                <img key={i} src={m} alt="" className="post-img" />
              ) : (
                <video key={i} src={m} controls className="post-img" />
              )
            )}
          </div>
        )}
        {post.tags && post.tags.length > 0 && (
          <div className="post-tags">
            {post.tags.map((t) => (
              <span key={t} className="tag">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="post-stats muted">
        {formatNumber(post.likesCount)} likes · {formatNumber(post.commentsCount)} comments ·{' '}
        {formatNumber(post.sharesCount)} shares
      </div>

      <div className="post-actions">
        <button className={`act ${post.liked ? 'liked' : ''}`} onClick={toggleLike}>
          {post.liked ? '❤️' : '🤍'} Like
        </button>
        <button className="act" onClick={() => setShowComments(!showComments)}>
          💬 Comment
        </button>
        <button className="act" onClick={share}>
          {copied ? '✅ Copied!' : '↗️ Share'}
        </button>
        <button className={`act ${post.saved ? 'saved' : ''}`} onClick={toggleSave}>
          {post.saved ? '🔖' : '📑'} Save
        </button>
      </div>

      {showComments && <CommentSection targetType="Post" targetId={post._id} />}
    </article>
  );
}
