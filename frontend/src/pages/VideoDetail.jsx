import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import Avatar from '../components/Avatar';
import CommentSection from '../components/CommentSection';
import { VideoCard } from '../components/ResourceCard';
import { formatNumber, timeAgo } from '../utils/format';
import '../components/ResourceCard.css';
import './Videos.css';

export default function VideoDetail() {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .get(`/videos/${id}`, { params: { record: 1 } })
      .then(({ data }) => {
        setVideo(data);
        api.post(`/videos/${id}/history`).catch(() => {});
      })
      .catch((e) => setError(errorMessage(e, 'Video not found')))
      .finally(() => setLoading(false));
  }, [id]);

  const act = (path, mutate) => async () => {
    try {
      const { data } = await api.post(path);
      mutate(data);
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  const like = act(`/videos/${id}/like`, (d) =>
    setVideo((v) => ({ ...v, liked: d.liked, likesCount: d.likesCount }))
  );
  const save = act(`/videos/${id}/save`, (d) => setVideo((v) => ({ ...v, saved: d.saved })));
  const watchLater = act(`/videos/${id}/watch-later`, () => alert('Added to Watch Later'));

  if (loading) {
    return (
      <div className="loading">
        <span className="spinner" />
      </div>
    );
  }
  if (error) return <div className="error-box">{error}</div>;
  if (!video) return <div className="empty">Video not found.</div>;

  const creator = video.creator || {};
  const isEmbed = video.videoUrl && /youtube\.com|youtu\.be|player\.vimeo|drive\.google/.test(video.videoUrl);

  return (
    <div className="page video-detail">
      <Link to="/videos" className="back-link">← Back to videos</Link>

      <div className="card player-card">
        {video.videoUrl ? (
          isEmbed ? (
            <iframe
              className="video-frame"
              src={video.videoUrl}
              title={video.title}
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          ) : (
            <video className="video-frame" src={video.videoUrl} controls />
          )
        ) : (
          <div className="video-frame video-frame-ph">🎬</div>
        )}
      </div>

      <div className="card video-info">
        <div className="video-info-head">
          <div>
            {video.subject && <span className="tag">{video.subject}</span>}
            <h1>{video.title}</h1>
            <div className="muted">
              👁 {formatNumber(video.views)} views · ❤ {formatNumber(video.likesCount)} likes ·{' '}
              {formatNumber(video.savesCount)} saves · {timeAgo(video.createdAt)}
            </div>
          </div>
          <div className="video-actions">
            <button className={`btn ${video.liked ? '' : 'btn-outline'}`} onClick={like}>
              {video.liked ? '❤️ Liked' : '🤍 Like'}
            </button>
            <button className={`btn btn-outline ${video.saved ? 'saved' : ''}`} onClick={save}>
              {video.saved ? '🔖 Saved' : '📑 Save'}
            </button>
            <button className="btn btn-outline" onClick={watchLater}>⏰ Watch later</button>
          </div>
        </div>
        {video.description && <p className="video-desc">{video.description}</p>}
        {video.tags && video.tags.length > 0 && (
          <div className="rc-tags">
            {video.tags.map((t) => (
              <span key={t} className="tag">#{t}</span>
            ))}
          </div>
        )}
        {creator._id && (
          <div className="video-creator">
            <Link to={`/profile/${creator.username}`}>
              <Avatar user={creator} size={40} />
            </Link>
            <div>
              <Link to={`/profile/${creator.username}`} className="video-creator-name">
                {creator.name}
                {creator.isVerified && <span className="badge badge-verified">✓</span>}
              </Link>
              <div className="muted">{creator.department || creator.bio}</div>
            </div>
          </div>
        )}
      </div>

      <div className="card video-comments">
        <h3>Comments</h3>
        <CommentSection targetType="Video" targetId={video._id} />
      </div>

      {video.related && video.related.length > 0 && (
        <div className="video-related">
          <h3>Related videos</h3>
          <div className="grid grid-4">
            {video.related.map((v) => (
              <VideoCard key={v._id} video={v} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}