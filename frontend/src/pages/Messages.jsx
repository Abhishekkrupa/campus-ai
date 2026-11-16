import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { timeAgo } from '../utils/format';
import { attachmentKind, fileIcon, isAllowedAttachment } from '../utils/attachments';
import './Messages.css';

function BubbleAttachment({ m }) {
  if (!m.attachment) return null;
  const kind = attachmentKind(m.attachmentType);
  const url = m.attachment;
  const name = m.fileName || decodeURIComponent(String(url).split('/').pop() || 'file');

  if (kind === 'image') {
    return (
      <a className="msg-attach-image" href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={name} loading="lazy" />
      </a>
    );
  }
  if (kind === 'video') {
    return <video className="msg-attach-video" src={url} controls preload="metadata" />;
  }
  return (
    <a className="msg-attach-doc" href={url} target="_blank" rel="noreferrer" download={name}>
      <span className="msg-doc-icon">{fileIcon(name)}</span>
      <span className="msg-doc-meta">
        <span className="msg-doc-name">{name}</span>
        <span className="msg-doc-open muted">Open / Download</span>
      </span>
    </a>
  );
}

export default function Messages() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [convs, setConvs] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [attach, setAttach] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef(null);

  const loadConvs = useCallback(async () => {
    try {
      const { data } = await api.get('/messages');
      setConvs(data);
      return data;
    } catch (e) {
      alert(errorMessage(e));
      return [];
    }
  }, []);

  useEffect(() => {
    loadConvs();
  }, [loadConvs]);

  useEffect(() => {
    const userId = params.get('to');
    if (!userId) return;
    openWith(userId);
    params.delete('to');
    const url = new URL(window.location.href);
    url.searchParams.delete('to');
    window.history.replaceState({}, '', url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const openConv = async (conv) => {
    setActive(conv);
    setLoadingConv(true);
    try {
      const { data: msgs } = await api.get(`/messages/${conv._id}`);
      setMessages(msgs);
    } catch (e) {
      alert(errorMessage(e));
    } finally {
      setLoadingConv(false);
    }
    setConvs((prev) => prev.map((c) => (c._id === conv._id ? { ...c, unread: 0 } : c)));
  };

  const openWith = async (userId) => {
    setLoadingConv(true);
    try {
      const { data: conv } = await api.post(`/messages/with/${userId}`);
      setActive(conv);
      const { data: msgs } = await api.get(`/messages/${conv._id}`);
      setMessages(msgs);
      loadConvs();
    } catch (e) {
      alert(errorMessage(e));
    } finally {
      setLoadingConv(false);
    }
  };

  const pickFile = () => fileRef.current?.click();

  const onPick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!isAllowedAttachment(file.type)) {
      alert('Unsupported file type. Allowed: images, PDF, Word, PowerPoint, text files and videos.');
      return;
    }
    setUploading(true);
    setAttach({ name: file.name, size: file.size, url: '', mimetype: file.type });
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/upload', fd);
      setAttach({ name: file.name, size: file.size, url: data.url, mimetype: data.mimetype || file.type });
    } catch (err) {
      setAttach(null);
      alert(errorMessage(err, 'Failed to upload file'));
    } finally {
      setUploading(false);
    }
  };

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    const attachData = attach && attach.url ? { attachment: attach.url, attachmentType: attach.mimetype, fileName: attach.name } : {};
    if ((!body && !attachData.attachment) || !active || sending || uploading) return;
    const tempId = `t-${Date.now()}`;
    setText('');
    setSending(true);
    setMessages((m) => [...m, { _id: tempId, sender: user._id, content: body, ...attachData }]);
    try {
      const { data } = await api.post(`/messages/${active._id}`, { content: body, ...attachData });
      setMessages((m) => [...m.filter((x) => x._id !== tempId), data]);
      setAttach(null);
      loadConvs();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const refreshActive = async () => {
    if (!active) return;
    try {
      const { data } = await api.get(`/messages/${active._id}`);
      setMessages(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const t = setInterval(refreshActive, 5000);
    return () => clearInterval(t);
  });

  return (
    <div className="page">
      <h2 className="section-title">Messages</h2>
      <div className="msg-wrap card">
        <aside className="msg-list">
          {convs.length === 0 ? (
            <div className="empty">No conversations yet. Open someone's profile and send them a message.</div>
          ) : (
            convs.map((c) => {
              const other = c.other || {};
              return (
                <button
                  key={c._id}
                  className={`msg-item ${active?._id === c._id ? 'active' : ''}`}
                  onClick={() => openConv(c)}
                >
                  <Avatar user={other} size={40} />
                  <div className="msg-item-main">
                    <div className="msg-item-head">
                      <span className="msg-name">{other.name}</span>
                      {!!c.unread && <span className="msg-unread">{c.unread}</span>}
                    </div>
                    <div className="msg-preview muted">{c.lastMessage || 'Say hi!'}</div>
                    <div className="msg-time muted">{timeAgo(c.lastMessageAt)}</div>
                  </div>
                </button>
              );
            })
          )}
        </aside>

        <div className="msg-thread">
          {!active ? (
            <div className="empty">Select a conversation to start chatting.</div>
          ) : (
            <>
              <div className="msg-thread-head">
                <Avatar user={active.other} size={36} />
                <span className="msg-name">{active.other?.name}</span>
              </div>
              <div className="msg-thread-body">
                {loadingConv ? (
                  <div className="loading"><span className="spinner" /></div>
                ) : messages.length === 0 ? (
                  <div className="empty">No messages yet. Say hello!</div>
                ) : (
                  messages.map((m) => {
                    const mine = String(m.sender && (m.sender._id || m.sender)) === String(user._id);
                    const sender = m.sender && m.sender.name ? m.sender : {};
                    return (
                      <div key={m._id} className={`msg-bubble ${mine ? 'mine' : 'theirs'}`}>
                        {!mine && sender.name && <div className="msg-sender muted">{sender.name}</div>}
                        <BubbleAttachment m={m} />
                        {m.content && <div>{m.content}</div>}
                        {m.resourceId && (
                          <Link className="msg-note-link" to={`/notes/${m.resourceId}`}>
                            📒 Open shared note
                          </Link>
                        )}
                        <div className="msg-bubble-time muted">{timeAgo(m.createdAt)}</div>
                      </div>
                    );
                  })
                )}
              </div>
              <form className="msg-composer" onSubmit={send}>
                <button
                  type="button"
                  className="msg-attach-btn"
                  title="Attach a file"
                  onClick={pickFile}
                  disabled={uploading}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  className="msg-file-input"
                  hidden
                  accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.rtf"
                  onChange={onPick}
                />
                {attach ? (
                  <div className="msg-attach-chip">
                    {uploading && <span className="spinner" />}
                    <span className="msg-chip-name">{attach.name}</span>
                    {!uploading && (
                      <button
                        type="button"
                        className="msg-chip-remove"
                        title="Remove attachment"
                        onClick={() => setAttach(null)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ) : null}
                <input
                  className="input"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a message..."
                />
                <button className="btn" disabled={(!text.trim() && !attach?.url) || sending || uploading}>
                  {sending ? <span className="spinner" /> : 'Send'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}