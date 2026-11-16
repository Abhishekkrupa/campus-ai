import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import { formatBytes, formatNumber, timeAgo } from '../utils/format';
import './ResourceCard.css';

export function NoteCard({ note }) {
  const author = note.author || {};
  return (
    <Link to={`/notes/${note._id}`} className="card resource-card">
      <div className="rc-body">
        <span className="tag">📒 {note.fileType || 'Note'}{note.fileSize ? ` · ${formatBytes(note.fileSize)}` : ''}</span>
        <h3>{note.title}</h3>
        <p className="rc-desc">{note.description || 'No description'}</p>
        <div className="rc-tags">
          {note.tags &&
            note.tags.slice(0, 3).map((t) => (
              <span key={t} className="tag">
                #{t}
              </span>
            ))}
        </div>
      </div>
      <div className="rc-foot">
        <div className="rc-author">
          <Avatar user={author} size={24} />
          <span>{author.name}</span>
        </div>
        <span className="muted">
          ⬇ {formatNumber(note.downloads)} · 👁 {formatNumber(note.views)} · {timeAgo(note.createdAt)}
        </span>
      </div>
    </Link>
  );
}

export function VideoCard({ video }) {
  const creator = video.creator || {};
  return (
    <Link to={`/videos/${video._id}`} className="card resource-card">
      <div className="rc-thumb">
        {video.thumbnail ? (
          <img src={video.thumbnail} alt={video.title} />
        ) : (
          <span className="rc-thumb-ph">🎬</span>
        )}
        {video.duration && <span className="rc-dur">{video.duration}</span>}
      </div>
      <div className="rc-body">
        <span className="tag">📹 {video.subject || 'Video'}</span>
        <h3>{video.title}</h3>
        <p className="rc-desc">{video.description || ''}</p>
      </div>
      <div className="rc-foot">
        <div className="rc-author">
          <Avatar user={creator} size={24} />
          <span>{creator.name}</span>
        </div>
        <span className="muted">
          👁 {formatNumber(video.views)} · ❤ {formatNumber(video.likesCount)} · {timeAgo(video.createdAt)}
        </span>
      </div>
    </Link>
  );
}

export function ArticleCard({ article }) {
  const author = article.author || {};
  return (
    <Link to={`/articles`} className="card resource-card">
      <div className="rc-body">
        <span className="tag">📰 {article.readingTime || 1} min read</span>
        <h3>{article.title}</h3>
        <p className="rc-desc">{article.subtitle || (article.content || '').slice(0, 120)}</p>
      </div>
      <div className="rc-foot">
        <div className="rc-author">
          <Avatar user={author} size={24} />
          <span>{author.name}</span>
        </div>
        <span className="muted">👁 {formatNumber(article.views)} · {timeAgo(article.createdAt)}</span>
      </div>
    </Link>
  );
}

export function CreatorCard({ creator }) {
  const u = creator.user || creator || {};
  return (
    <Link to={`/profile/${u.username}`} className="card creator-card">
      <Avatar user={u} size={56} />
      <h4>
        {u.name}
        {u.isVerified && <span className="badge badge-verified">✓</span>}
      </h4>
      <div className="muted rc-dep">{u.department || u.bio}</div>
      {u.subjects && u.subjects.length > 0 && (
        <div className="rc-tags">
          {u.subjects.slice(0, 3).map((s) => (
            <span key={s} className="tag">
              {s}
            </span>
          ))}
        </div>
      )}
      <span className="rc-followers">{creator.followersCount ?? u.followersCount ?? 0} followers</span>
    </Link>
  );
}
