import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import Avatar from '../components/Avatar';
import { timeAgo } from '../utils/format';
import './Notifications.css';

const icons = {
  follower: '👤',
  post_like: '❤️',
  comment: '💬',
  share: '↗️',
  connection_request: '🤝',
  connection_accepted: '✅',
  message: '💬',
  system: '🔔',
  admin: '🛡️',
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications', { params: { category: category === 'All' ? undefined : category } });
      setNotifications(data.notifications);
      setUnread(data.unread);
    } catch (e) {
      alert(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (n) => {
    if (n.read) return;
    try {
      await api.put(`/notifications/${n._id}/read`);
      setNotifications((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  const markAll = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
      setUnread(0);
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  const categories = ['All', 'Social', 'Learning', 'System'];

  return (
    <div className="page">
      <div className="notif-head">
        <div>
          <h2 className="section-title">Notifications</h2>
          <div className="muted">{unread} unread</div>
        </div>
        {unread > 0 && (
          <button className="btn btn-outline btn-sm" onClick={markAll}>Mark all read</button>
        )}
      </div>

      <div className="feed-tabs">
        {categories.map((c) => (
          <button key={c} className={`compose-tab ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading"><span className="spinner" /></div>
      ) : notifications.length === 0 ? (
        <div className="empty card">No notifications in this category.</div>
      ) : (
        <div className="notif-list card">
          {notifications.map((n) => {
            const actor = n.actor || {};
            const inner = (
              <div className={`notif-item ${n.read ? '' : 'unread'}`}>
                <Avatar user={actor} size={40} />
                <div className="notif-body">
                  <div className="notif-title">
                    <span>{icons[n.type] || '🔔'} </span>
                    {actor.name ? <Link to={`/profile/${actor.username}`}>{actor.name}</Link> : null} {n.title}
                  </div>
                  <div className="notif-text">{n.message}</div>
                  <div className="notif-time muted">{timeAgo(n.createdAt)}</div>
                </div>
                {!n.read && <span className="notif-dot" />}
              </div>
            );
            return n.link ? (
              <Link key={n._id} to={n.link} onClick={() => markRead(n)} className="notif-link">
                {inner}
              </Link>
            ) : (
              <div key={n._id} onClick={() => markRead(n)}>
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}