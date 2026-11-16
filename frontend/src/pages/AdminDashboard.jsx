import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import Avatar from '../components/Avatar';
import { timeAgo } from '../utils/format';
import './Admin.css';

const tabs = [
  { v: 'overview', l: '📊 Overview' },
  { v: 'users', l: '👥 Users' },
  { v: 'creators', l: '🎛 Creators' },
  { v: 'reports', l: '🚩 Reports' },
  { v: 'moderation', l: '🛡 Moderation' },
  { v: 'verification', l: '✅ Verification' },
  { v: 'catalog', l: '🏛 Departments & Subjects' },
  { v: 'system', l: '📈 System analytics' },
  { v: 'ai', l: '🤖 AI usage' },
];

function BarChart({ series, color }) {
  if (!series || series.length === 0) return <div className="empty">No data</div>;
  const max = Math.max(...series.map((s) => s.value), 1);
  return (
    <div className="bar-chart">
      {series.map((s) => (
        <div key={s.date} className="bar-col" title={`${s.date}: ${s.value}`}>
          <div className="bar-fill" style={{ height: `${Math.max(4, (s.value / max) * 100)}%`, background: color || 'var(--primary)' }} />
          <span className="bar-label muted">{s.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const [dash, setDash] = useState(null);
  const [users, setUsers] = useState({ users: [], total: 0 });
  const [creators, setCreators] = useState({ creators: [], total: 0 });
  const [reports, setReports] = useState([]);
  const [moderation, setModeration] = useState(null);
  const [verification, setVerification] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sys, setSys] = useState(null);
  const [ai, setAi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [userSearch, setUserSearch] = useState('');
  const [modType, setModType] = useState('all');
  const [deptForm, setDeptForm] = useState({ name: '', code: '', faculty: '' });
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', department: '' });
  const [sysRange, setSysRange] = useState('30');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [d, u, c, r, v, dp, sb] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/users', { params: { search: userSearch || undefined } }),
        api.get('/admin/creators'),
        api.get('/admin/reports'),
        api.get('/admin/verification'),
        api.get('/admin/departments'),
        api.get('/admin/subjects'),
      ]);
      setDash(d.data);
      setUsers(u.data);
      setCreators(c.data);
      setReports(r.data);
      setVerification(v.data);
      setDepartments(dp.data);
      setSubjects(sb.data);
    } catch (e) {
      setError(errorMessage(e, 'Admin dashboard unavailable'));
    } finally {
      setLoading(false);
    }
  }, [userSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const loadModeration = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/moderation', { params: { type: modType === 'all' ? undefined : modType } });
      setModeration(data);
    } catch {
      // ignore
    }
  }, [modType]);

  useEffect(() => {
    loadModeration();
  }, [loadModeration]);

  const loadSystem = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/analytics', { params: { range: sysRange } });
      setSys(data);
    } catch {
      // ignore
    }
  }, [sysRange]);

  useEffect(() => {
    if (tab === 'system') loadSystem();
  }, [tab, loadSystem]);

  useEffect(() => {
    if (tab === 'ai')
      api
        .get('/admin/ai-usage')
        .then(({ data }) => setAi(data))
        .catch(() => {});
  }, [tab]);

  const handleReport = async (id, action) => {
    try {
      await api.put(`/admin/reports/${id}`, { action, adminNote: action === 'approve' ? 'Content removed' : 'Dismissed' });
      setReports((prev) => prev.filter((r) => r._id !== id));
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  const suspend = async (id) => {
    try {
      const { data } = await api.post(`/admin/users/${id}/suspend`);
      alert(`User status: ${data.status}`);
      load();
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  const deleteContent = async (type, id) => {
    if (!window.confirm(`Delete this ${type.toLowerCase()}?`)) return;
    try {
      await api.delete(`/admin/content/${type}/${id}`);
      loadModeration();
      load();
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  const approveVerification = async (id) => {
    try {
      await api.put(`/admin/verification/${id}`, { action: 'approve' });
      setVerification((prev) => prev.filter((v) => v._id !== id));
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  const declineVerification = async (id) => {
    try {
      await api.put(`/admin/verification/${id}`, { action: 'decline' });
      setVerification((prev) => prev.filter((v) => v._id !== id));
    } catch (e) {
      alert(errorMessage(e));
    }
  };

  const addDept = async (e) => {
    e.preventDefault();
    if (!deptForm.name.trim()) return;
    try {
      await api.post('/admin/departments', deptForm);
      setDeptForm({ name: '', code: '', faculty: '' });
      const { data } = await api.get('/admin/departments');
      setDepartments(data);
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const addSubject = async (e) => {
    e.preventDefault();
    if (!subjectForm.name.trim()) return;
    try {
      await api.post('/admin/subjects', subjectForm);
      setSubjectForm({ name: '', code: '', department: '' });
      const { data } = await api.get('/admin/subjects');
      setSubjects(data);
    } catch (err) {
      alert(errorMessage(err));
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

  const totals = dash?.totals || {};

  return (
    <div className="page">
      <h2 className="section-title">Admin Panel</h2>

      <div className="feed-tabs">
        {tabs.map((t) => (
          <button key={t.v} className={`compose-tab ${tab === t.v ? 'active' : ''}`} onClick={() => setTab(t.v)}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <div className="metric-grid">
            {[
              ['👥', format(totals.totalUsers), 'Total users'],
              ['🟢', format(totals.activeUsers), 'Active users'],
              ['🎛', format(totals.creators), 'Creators'],
              ['📒', format(totals.resources), 'Notes'],
              ['🎬', format(totals.videos), 'Videos'],
              ['💬', format(totals.posts), 'Posts'],
              ['⬇', format(totals.downloads), 'Downloads'],
              ['🤖', format(totals.aiRequests), 'AI requests'],
              ['🚩', format(totals.pendingReports), 'Pending reports'],
              ['🏛', format(totals.departments), 'Departments'],
              ['📚', format(totals.subjects), 'Subjects'],
              ['📤', format(totals.uploadsToday), 'Uploads today'],
            ].map(([icon, value, label], i) => (
              <div key={i} className="card metric">
                <div className="metric-icon">{icon}</div>
                <div>
                  <div className="metric-value">{value}</div>
                  <div className="muted">{label}</div>
                </div>
              </div>
            ))}
          </div>
          {dash?.growth?.userGrowth && (
            <div className="card chart-card">
              <h4>User growth (14 days)</h4>
              <BarChart series={dash.growth.userGrowth} />
            </div>
          )}
          {dash?.growth?.creatorGrowth && (
            <div className="card chart-card">
              <h4>Creator growth (14 days)</h4>
              <BarChart series={dash.growth.creatorGrowth} color="#16a34a" />
            </div>
          )}
        </div>
      )}

      {tab === 'users' && (
        <div>
          <div className="admin-toolbar">
            <input className="input" placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
          </div>
          <div className="card table-card">
            {users.users.map((u) => (
              <div key={u._id} className="admin-row">
                <Avatar user={u} size={38} />
                <div className="admin-row-main">
                  <div className="admin-row-name">
                    <Link to={`/profile/${u.username}`}>{u.name}</Link>
                    {u.isVerified && <span className="badge badge-verified">✓</span>}
                  </div>
                  <div className="muted">@{u.username} · {u.role} · {u.email}</div>
                </div>
                <span className={`tag ${u.status === 'suspended' ? 'danger-tag' : ''}`}>{u.status || 'active'}</span>
                <button className="btn btn-outline btn-sm" onClick={() => suspend(u._id)}>
                  {u.status === 'suspended' ? 'Unsuspend' : 'Suspend'}
                </button>
              </div>
            ))}
            {users.users.length === 0 && <div className="empty">No users found.</div>}
          </div>
          <div className="muted">{users.total} total users</div>
        </div>
      )}

      {tab === 'creators' && (
        <div className="card table-card">
          {creators.creators.map((c) => { const u = c.user || {}; return (
            <div key={c._id} className="admin-row">
              <Avatar user={u} size={38} />
              <div className="admin-row-main">
                <div className="admin-row-name">
                  <Link to={`/profile/${u.username}`}>{u.name}</Link>
                  {c.isVerified && <span className="badge badge-verified">✓</span>}
                </div>
                <div className="muted">@{u.username} · {c.category || 'Creator'} · {c.resourcesCount || 0} resources</div>
              </div>
              <span className="tag">👁 {format(c.views || 0)}</span>
            </div>
          ); })}
          {creators.creators.length === 0 && <div className="empty">No creators yet.</div>}
        </div>
      )}

      {tab === 'reports' && (
        <div className="card table-card">
          {reports.map((r) => (
            <div key={r._id} className="admin-row report-row">
              <div className="admin-row-main">
                <div className="admin-row-name">{r.targetType} {r.reason && <span className="tag">{r.reason}</span>}</div>
                <div className="muted">"{(r.details || r.description) || 'No details'}"</div>
                <div className="muted">Reported by {r.reportedBy?.name || 'Anonymous'} · {timeAgo(r.createdAt)}</div>
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => handleReport(r._id, 'approve')}>Remove content</button>
              <button className="btn btn-outline btn-sm" onClick={() => handleReport(r._id, 'dismiss')}>Dismiss</button>
            </div>
          ))}
          {reports.length === 0 && <div className="empty">No pending reports.</div>}
        </div>
      )}

      {tab === 'moderation' && (
        <div>
          <div className="feed-tabs">
            {['all', 'posts', 'videos', 'notes'].map((t) => (
              <button key={t} className={`compose-tab ${modType === t ? 'active' : ''}`} onClick={() => setModType(t)}>{t}</button>
            ))}
          </div>
          <div className="card table-card">
            {moderation && (Array.isArray(moderation) ? (
              moderation.map((item) => {
                const u = item.author || item.creator || {};
                const kind = item.fileType ? 'Note' : item.videoUrl ? 'Video' : 'Post';
                return (
                  <div key={item._id} className="admin-row">
                    <div className="admin-row-main">
                      <div className="admin-row-name">{kind}</div>
                      <div className="muted">{item.title || item.content || 'Untitled'}</div>
                      <div className="muted">by {u.name} · {timeAgo(item.createdAt)}</div>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteContent(kind, item._id)}>Delete</button>
                  </div>
                );
              })
            ) : (
              <>
                {Object.entries(moderation).map(([key, items]) => {
                  const kind = key === 'videos' ? 'Video' : key === 'notes' ? 'Note' : key === 'comments' ? 'Comment' : 'Post';
                  return (
                    <div key={key}>
                      <h4 className="admin-subhead">{key} ({items.length})</h4>
                      {items.map((item) => {
                        const u = item.author || item.creator || {};
                        return (
                          <div key={item._id} className="admin-row">
                            <div className="admin-row-main">
                              <div className="muted">{item.title || item.content || 'Untitled'}</div>
                              <div className="muted">by {u.name} · {timeAgo(item.createdAt)}</div>
                            </div>
                            <button className="btn btn-danger btn-sm" onClick={() => deleteContent(kind, item._id)}>Delete</button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            ))}
            {!moderation && <div className="empty">Loading moderation...</div>}
          </div>
        </div>
      )}

      {tab === 'verification' && (
        <div className="card table-card">
          {verification.map((v) => (
            <div key={v._id} className="admin-row">
              <Avatar user={v.user} size={38} />
              <div className="admin-row-main">
                <div className="admin-row-name">{v.user?.name}</div>
                <div className="muted">{v.user?.email} · @{v.user?.username}</div>
                {v.user?.department && <div className="muted">🏛 {v.user.department}</div>}
                {v.verificationRequest?.reason && <div className="muted verif-reason">"{(v.verificationRequest || {}).reason}"</div>}
              </div>
              <button className="btn btn-sm" onClick={() => approveVerification(v._id)}>Approve</button>
              <button className="btn btn-outline btn-sm" onClick={() => declineVerification(v._id)}>Decline</button>
            </div>
          ))}
          {verification.length === 0 && <div className="empty">No pending verification requests.</div>}
        </div>
      )}

      {tab === 'catalog' && (
        <div className="catalog">
          <div className="card admin-form">
            <h4>Add department</h4>
            <form onSubmit={addDept}>
              <div className="form-row">
                <label className="label">Name</label>
                <input className="input" value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} />
              </div>
              <div className="form-row">
                <label className="label">Code</label>
                <input className="input" value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} />
              </div>
              <div className="form-row">
                <label className="label">Faculty</label>
                <input className="input" value={deptForm.faculty} onChange={(e) => setDeptForm({ ...deptForm, faculty: e.target.value })} />
              </div>
              <button className="btn btn-block" disabled={!deptForm.name.trim()}>Add department</button>
            </form>
          </div>
          <div className="card admin-form">
            <h4>Add subject</h4>
            <form onSubmit={addSubject}>
              <div className="form-row">
                <label className="label">Name</label>
                <input className="input" value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })} />
              </div>
              <div className="form-row">
                <label className="label">Code</label>
                <input className="input" value={subjectForm.code} onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })} />
              </div>
              <div className="form-row">
                <label className="label">Department</label>
                <select className="select" value={subjectForm.department} onChange={(e) => setSubjectForm({ ...subjectForm, department: e.target.value })}>
                  <option value="">None</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-block" disabled={!subjectForm.name.trim()}>Add subject</button>
            </form>
          </div>
          <div className="card chart-card" style={{ gridColumn: '1 / -1' }}>
            <h4>Departments</h4>
            <div className="dept-chips">
              {departments.map((d) => (
                <span key={d._id} className="dept-chip">{d.name} {d.code && `(${d.code})`}</span>
              ))}
            </div>
            {departments.length === 0 && <div className="empty">No departments yet.</div>}
          </div>
          <div className="card chart-card" style={{ gridColumn: '1 / -1' }}>
            <h4>Subjects</h4>
            <div className="dept-chips">
              {subjects.map((s) => (
                <span key={s._id} className="subject-chip">{s.name} {s.code && `(${s.code})`}</span>
              ))}
            </div>
            {subjects.length === 0 && <div className="empty">No subjects yet.</div>}
          </div>
        </div>
      )}

      {tab === 'system' && sys && (
        <div>
          <div className="admin-toolbar">
            <div className="feed-tabs" style={{ margin: 0 }}>
              {['7', '30', '90'].map((r) => (
                <button key={r} className={`compose-tab ${sysRange === r ? 'active' : ''}`} onClick={() => setSysRange(r)}>{r} days</button>
              ))}
            </div>
          </div>
          <div className="metric-grid">
            {[['👥', format(sys.totals?.users), 'New users'], ['💬', format(sys.totals?.posts), 'New posts'], ['🎬', format(sys.totals?.videos), 'New videos'], ['📒', format(sys.totals?.notes), 'New notes'], ['❤️', format(sys.totals?.likes), 'Likes'], ['💬', format(sys.totals?.comments), 'Comments'], ['⚡', format(sys.totals?.activities), 'Activities']].map(([icon, value, label], i) => (
              <div key={i} className="card metric">
                <div className="metric-icon">{icon}</div>
                <div>
                  <div className="metric-value">{value}</div>
                  <div className="muted">{label}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="card chart-card">
            <h4>User registrations</h4>
            <BarChart series={sys.userSeries} />
          </div>
          <div className="card chart-card">
            <h4>Platform activity</h4>
            <BarChart series={sys.activitySeries} color="#16a34a" />
          </div>
        </div>
      )}

      {tab === 'ai' && ai && (
        <div>
          <div className="card metric metric-wide" style={{ marginBottom: 16 }}>
            <div className="metric-icon">🤖</div>
            <div>
              <div className="metric-value">{format(ai.total)}</div>
              <div className="muted">Recent AI requests (last 200)</div>
            </div>
          </div>
          <div className="card chart-card">
            <h4>By type</h4>
            <div className="dept-chips">
              {Object.entries(ai.byType || {}).map(([k, v]) => (
                <span key={k} className="subject-chip">{k} · {v}</span>
              ))}
            </div>
          </div>
          <div className="card chart-card">
            <h4>Recent</h4>
            <div className="top-list">
              {ai.recent.map((r, i) => (
                <div key={i} className="top-item">
                  <span className="tag">{r.type}</span>
                  <span className="muted">{timeAgo(r.createdAt)}</span>
                </div>
              ))}
              {ai.recent.length === 0 && <div className="empty">No AI activity recorded.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function format(n = 0) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}