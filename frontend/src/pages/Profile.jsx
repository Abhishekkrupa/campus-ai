import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import PostCard from '../components/PostCard';
import { NoteCard, VideoCard, ArticleCard } from '../components/ResourceCard';
import { formatNumber } from '../utils/format';
import './Profile.css';

export default function Profile() {
  const { username } = useParams();
  const { user: me, updateUser } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tab = params.get('tab') || 'posts';

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [content, setContent] = useState([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');
  const [creatorForm, setCreatorForm] = useState({ category: '', expertise: '', subjects: '', tagline: '', bio: '' });

  const isMe = me && user && String(me._id) === String(user._id);

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/users/${username}`);
      setUser(data);
      setEditForm({
        name: data.name || '',
        bio: data.bio || '',
        department: data.department || '',
        college: data.college || '',
        course: data.course || '',
        semester: data.semester || '',
        avatar: data.avatar || '',
        coverImage: data.coverImage || '',
        phone: data.phone || '',
      });
      setCreatorForm({
        category: data.creatorId?.category || '',
        expertise: (data.creatorId?.expertise || []).join(', '),
        subjects: (data.subjects || []).join(', '),
        tagline: data.creatorId?.tagline || '',
        bio: data.creatorId?.bio || data.bio || '',
      });
    } catch (e) {
      setError(errorMessage(e, 'Profile not found'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const loadContent = async () => {
    if (!user) return;
    setContentLoading(true);
    try {
      let data = [];
      if (tab === 'posts') {
        const { data: d } = await api.get('/posts', { params: { authorId: user._id } });
        data = d;
      } else if (tab === 'notes') {
        const { data: d } = await api.get('/notes', { params: { author: user._id } });
        data = d;
      } else if (tab === 'videos') {
        const { data: d } = await api.get('/videos', { params: { creator: user._id } });
        data = d;
      } else if (tab === 'articles') {
        const { data: d } = await api.get('/articles', { params: { author: user._id } });
        data = d;
      } else if (tab === 'followers') {
        const { data: d } = await api.get(`/users/${user._id}/followers`);
        data = d;
      } else if (tab === 'following') {
        const { data: d } = await api.get(`/users/${user._id}/following`);
        data = d;
      } else if (tab === 'connections') {
        const { data: d } = await api.get(`/users/${user._id}/connections`);
        data = d;
      }
      setContent(data);
    } catch (e) {
      alert(errorMessage(e));
    } finally {
      setContentLoading(false);
    }
  };

  useEffect(() => {
    loadContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user]);

  const follow = async () => {
    try {
      if (user.viewerFollows) {
        await api.delete(`/users/${user._id}/follow`);
        setUser((u) => ({ ...u, viewerFollows: false, followersCount: Math.max(0, (u.followersCount || 0) - 1) }));
      } else {
        await api.post(`/users/${user._id}/follow`);
        setUser((u) => ({ ...u, viewerFollows: true, followersCount: (u.followersCount || 0) + 1 }));
      }
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  const connect = async () => {
    try {
      await api.post(`/users/${user._id}/connect`);
      setUser((u) => ({ ...u, connectionState: 'pending' }));
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  const removeConnection = async () => {
    try {
      await api.delete(`/users/${user._id}/connect`);
      setUser((u) => ({ ...u, connectionState: 'none' }));
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  const message = () => navigate(`/messages?to=${user._id}`);

  const saveEdits = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put(`/users/${user._id}`, editForm);
      setUser((u) => ({ ...u, ...editForm }));
      if (isMe) updateUser({ ...me, ...editForm });
      setEditing(false);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (e, type, field) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    setUploading(type);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post(`/upload/${type}`, fd);
      const url = data.url;
      setEditForm((f) => ({ ...f, [field]: url }));
      setUser((u) => ({ ...u, [field]: url }));
      if (isMe) updateUser({ ...me, [field]: url });
    } catch (err) {
      alert(errorMessage(err, 'Upload failed'));
    } finally {
      setUploading('');
      e.target.value = '';
    }
  };

  const switchToCreator = async () => {
    if (!window.confirm('Switch to a Creator account? You can publish articles and use creator tools.')) return;
    try {
      const { data } = await api.put('/users/creator', { category: creatorForm.category, subjects: creatorForm.subjects.split(',').map((s) => s.trim()).filter(Boolean) });
      updateUser(data);
      setUser((u) => ({ ...u, ...data }));
      alert('You are now a creator! Welcome.');
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  const saveCreator = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const subjects = creatorForm.subjects.split(',').map((s) => s.trim()).filter(Boolean);
      const { data } = await api.put('/users/creator-profile', {
        ...creatorForm,
        expertise: creatorForm.expertise.split(',').map((s) => s.trim()).filter(Boolean),
        subjects,
      });
      setCreatorForm({ ...creatorForm, ...data, expertise: (data.expertise || []).join(', '), subjects: (data.subjects || []).join(', ') });
      alert('Creator profile saved.');
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const requestVerification = async () => {
    const reason = window.prompt('Why should your account be verified?');
    if (!reason) return;
    try {
      await api.post('/users/creator/verify', { reason });
      alert('Verification request submitted.');
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <span className="spinner" />
      </div>
    );
  }
  if (error || !user) return <div className="error-box">{error || 'Profile not found'}</div>;

  const tabs = [
    { v: 'posts', l: 'Posts' },
    { v: 'notes', l: 'Notes' },
    { v: 'videos', l: 'Videos' },
    { v: 'articles', l: 'Articles' },
    { v: 'followers', l: `Followers ${formatNumber(user.followersCount)}` },
    { v: 'following', l: `Following ${formatNumber(user.followingCount)}` },
    { v: 'connections', l: `Connections ${formatNumber(user.connectionsCount)}` },
  ];

  return (
    <div className="page">
      <div className="profile-hero card">
        {user.coverImage ? <img className="profile-cover" src={user.coverImage} alt="" /> : <div className="profile-cover profile-cover-ph" />}
        {isMe && (
          <label className={`profile-cam cover-cam ${uploading === 'cover' ? 'uploading' : ''}`} title="Change banner">
            {uploading === 'cover' ? <span className="spinner" /> : '📷'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => uploadImage(e, 'cover', 'coverImage')} />
          </label>
        )}
        <div className="profile-body">
          <div className="profile-avatar">
            <Avatar user={user} size={104} />
            {isMe && (
              <label className={`profile-cam avatar-cam ${uploading === 'avatar' ? 'uploading' : ''}`} title="Change profile picture">
                {uploading === 'avatar' ? <span className="spinner" /> : '📷'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => uploadImage(e, 'avatar', 'avatar')} />
              </label>
            )}
          </div>
          <div className="profile-mid">
            <div className="profile-name">
              {user.name}
              {user.isVerified && <span className="badge badge-verified">✓ Verified</span>}
              {user.role === 'CREATOR' && <span className="badge badge-role">CREATOR</span>}
            </div>
            <div className="muted">@{user.username}</div>
            {user.bio && <p className="profile-bio">{user.bio}</p>}
            <div className="profile-facts">
              {user.department && <span>🏛️ {user.department}</span>}
              {user.college && <span>🎓 {user.college}</span>}
              {user.semester && <span>📚 Sem {user.semester}</span>}
              {user.course && <span>📖 {user.course}</span>}
              {user.subjects && user.subjects.length > 0 && (
                <div className="rc-tags">
                  {user.subjects.map((s) => (
                    <span key={s} className="tag">{s}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="profile-actions">
            {!isMe && (
              <>
                <button className={`btn ${user.viewerFollows ? 'btn-outline' : ''}`} onClick={follow}>
                  {user.viewerFollows ? '✓ Following' : '+ Follow'}
                </button>
                <button className="btn btn-outline" onClick={message}>💬 Message</button>
                {user.connectionState === 'none' && !user.isBlocked && (
                  <button className="btn btn-outline" onClick={connect}>🤝 Connect</button>
                )}
                {user.connectionState === 'pending' && (
                  <span className="tag">⏳ Request pending</span>
                )}
                {user.connectionState === 'accepted' && (
                  <button className="btn btn-outline" onClick={removeConnection}>Remove connection</button>
                )}
              </>
            )}
            {isMe && !editing && (
              <>
                <button className="btn btn-outline" onClick={() => setEditing(true)}>✏ Edit profile</button>
                {user.role !== 'CREATOR' && (
                  <button className="btn btn-outline" onClick={switchToCreator}>🎛 Become a creator</button>
                )}
                {user.role === 'CREATOR' && !user.isVerified && user.verificationStatus !== 'pending' && (
                  <button className="btn btn-outline" onClick={requestVerification}>✅ Request verification</button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {isMe && editing && (
        <form className="card profile-edit" onSubmit={saveEdits}>
          <h3>Edit profile</h3>
          <div className="grid grid-2">
            <div className="form-row">
              <label className="label">Name</label>
              <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="form-row">
              <label className="label">Department</label>
              <input className="input" value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-2">
            <div className="form-row">
              <label className="label">College</label>
              <input className="input" value={editForm.college} onChange={(e) => setEditForm({ ...editForm, college: e.target.value })} />
            </div>
            <div className="form-row">
              <label className="label">Course</label>
              <input className="input" value={editForm.course} onChange={(e) => setEditForm({ ...editForm, course: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-2">
            <div className="form-row">
              <label className="label">Semester</label>
              <input className="input" value={editForm.semester} onChange={(e) => setEditForm({ ...editForm, semester: e.target.value })} />
            </div>
            <div className="form-row">
              <label className="label">Phone number</label>
              <input className="input" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Used to receive notes shared by phone" />
            </div>
          </div>
          <div className="form-row">
              <label className="label">Bio</label>
              <textarea className="textarea" value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} />
            </div>
          <div className="form-row">
            <label className="label">Cover / Banner image</label>
            <div className="upload-preview">
              <div className="upload-preview-cover">
                {editForm.coverImage ? <img src={editForm.coverImage} alt="cover" /> : <span className="muted">No banner</span>}
              </div>
              <label className="btn btn-outline btn-sm">
                {uploading === 'cover' ? <span className="spinner" /> : '⬆ Upload banner'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => uploadImage(e, 'cover', 'coverImage')} disabled={uploading === 'cover'} />
              </label>
            </div>
          </div>
          <div className="form-row">
            <label className="label">Avatar (profile picture)</label>
            <div className="upload-preview">
              <div className="upload-preview-avatar">
                {editForm.avatar ? <img src={editForm.avatar} alt="avatar" /> : <span className="muted">No avatar</span>}
              </div>
              <label className="btn btn-outline btn-sm">
                {uploading === 'avatar' ? <span className="spinner" /> : '⬆ Upload photo'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => uploadImage(e, 'avatar', 'avatar')} disabled={uploading === 'avatar'} />
              </label>
            </div>
          </div>
          <div className="profile-edit-actions">
            <button className="btn" disabled={saving}>{saving ? <span className="spinner" /> : 'Save'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}

      {isMe && user.role === 'CREATOR' && (
        <form className="card profile-edit" onSubmit={saveCreator}>
          <h3>Creator profile</h3>
          <div className="grid grid-2">
            <div className="form-row">
              <label className="label">Category</label>
              <input className="input" value={creatorForm.category} onChange={(e) => setCreatorForm({ ...creatorForm, category: e.target.value })} placeholder="e.g. Academic" />
            </div>
            <div className="form-row">
              <label className="label">Tagline</label>
              <input className="input" value={creatorForm.tagline} onChange={(e) => setCreatorForm({ ...creatorForm, tagline: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-2">
            <div className="form-row">
              <label className="label">Expertise (comma separated)</label>
              <input className="input" value={creatorForm.expertise} onChange={(e) => setCreatorForm({ ...creatorForm, expertise: e.target.value })} />
            </div>
            <div className="form-row">
              <label className="label">Subjects (comma separated)</label>
              <input className="input" value={creatorForm.subjects} onChange={(e) => setCreatorForm({ ...creatorForm, subjects: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <label className="label">Bio</label>
            <textarea className="textarea" value={creatorForm.bio} onChange={(e) => setCreatorForm({ ...creatorForm, bio: e.target.value })} />
          </div>
          <button className="btn" disabled={saving}>{saving ? <span className="spinner" /> : 'Save creator profile'}</button>
        </form>
      )}

      <div className="feed-tabs">
        {tabs.map((t) => (
          <button key={t.v} className={`compose-tab ${tab === t.v ? 'active' : ''}`} onClick={() => navigate(`?tab=${t.v}`)}>
            {t.l}
          </button>
        ))}
      </div>

      {contentLoading ? (
        <div className="loading"><span className="spinner" /></div>
      ) : content.length === 0 ? (
        <div className="empty card">Nothing here yet.</div>
      ) : tab === 'posts' ? (
        content.map((p) => <PostCard key={p._id} post={p} />)
      ) : tab === 'notes' ? (
        <div className="grid grid-4">{content.map((n) => <NoteCard key={n._id} note={n} />)}</div>
      ) : tab === 'videos' ? (
        <div className="grid grid-4">{content.map((v) => <VideoCard key={v._id} video={v} />)}</div>
      ) : tab === 'articles' ? (
        <div className="grid grid-4">{content.map((a) => <ArticleCard key={a._id} article={a} />)}</div>
      ) : (
        <div className="conn-list">
          {content.map((u) => (
            <Link key={u._id} to={`/profile/${u.username}`} className="card conn-card">
              <Avatar user={u} size={48} />
              <div>
                <div className="conn-name">{u.name}{u.isVerified && <span className="badge badge-verified">✓</span>}</div>
                <div className="muted">{u.department || u.college || u.bio}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}