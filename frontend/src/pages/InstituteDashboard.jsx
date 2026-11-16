import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../api/client';
import { timeAgo } from '../utils/format';
import './Admin.css';

export default function InstituteDashboard() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [infoForm, setInfoForm] = useState({ instituteName: '', department: '', bio: '' });
  const [savingInfo, setSavingInfo] = useState(false);

  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', description: '' });
  const [addingSubject, setAddingSubject] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', code: '', description: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [p, s] = await Promise.all([api.get('/institute/me'), api.get('/institute/subjects')]);
      setProfile(p.data);
      setSubjects(s.data);
      setInfoForm({
        instituteName: p.data.instituteName || p.data.college || '',
        department: p.data.department || '',
        bio: p.data.bio || '',
      });
    } catch (e) {
      setError(errorMessage(e, 'Institute dashboard unavailable'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveInfo = async (e) => {
    e.preventDefault();
    setSavingInfo(true);
    setSaved(false);
    try {
      const { data } = await api.put('/institute/me', infoForm);
      setProfile(data);
      updateUser(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSavingInfo(false);
    }
  };

  const addSubject = async (e) => {
    e.preventDefault();
    if (!subjectForm.name.trim()) return;
    setAddingSubject(true);
    try {
      const { data } = await api.post('/institute/subjects', subjectForm);
      setSubjects((prev) => [data, ...prev]);
      setSubjectForm({ name: '', code: '', description: '' });
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setAddingSubject(false);
    }
  };

  const startEdit = (s) => {
    setEditingId(s._id);
    setEditForm({ name: s.name, code: s.code || '', description: s.description || '' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', code: '', description: '' });
  };

  const saveSubject = async (s) => {
    try {
      const { data } = await api.put(`/institute/subjects/${editingId}`, editForm);
      setSubjects((prev) => prev.map((x) => (x._id === editingId ? data : x)));
      cancelEdit();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const deleteSubject = async (s) => {
    if (!window.confirm(`Delete subject "${s.name}"?`)) return;
    try {
      await api.delete(`/institute/subjects/${s._id}`);
      setSubjects((prev) => prev.filter((x) => x._id !== s._id));
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

  const instituteName = profile?.instituteName || profile?.college || user?.instituteName || 'Your Institute';

  return (
    <div className="page">
      <h2 className="section-title">🏫 Institute Dashboard</h2>
      <p className="muted" style={{ marginTop: -8 }}>
        Manage your institute profile and the subjects offered by {instituteName}.
      </p>

      <div className="metric-grid">
        <div className="card metric">
          <div className="metric-icon">🏛</div>
          <div>
            <div className="metric-value">{instituteName}</div>
            <div className="muted">Institute</div>
          </div>
        </div>
        <div className="card metric">
          <div className="metric-icon">📚</div>
          <div>
            <div className="metric-value">{subjects.length}</div>
            <div className="muted">Subjects offered</div>
          </div>
        </div>
      </div>

      <div className="catalog">
        <div className="card admin-form">
          <h4>Institute details</h4>
          <form onSubmit={saveInfo}>
            <div className="form-row">
              <label className="label">Institute name</label>
              <input
                className="input"
                required
                value={infoForm.instituteName}
                onChange={(e) => setInfoForm({ ...infoForm, instituteName: e.target.value })}
                placeholder="e.g. Greenfield Institute of Technology"
              />
            </div>
            <div className="form-row">
              <label className="label">Department</label>
              <input
                className="input"
                value={infoForm.department}
                onChange={(e) => setInfoForm({ ...infoForm, department: e.target.value })}
                placeholder="e.g. Computer Science"
              />
            </div>
            <div className="form-row">
              <label className="label">About</label>
              <textarea
                className="input textarea"
                value={infoForm.bio}
                maxLength={500}
                onChange={(e) => setInfoForm({ ...infoForm, bio: e.target.value })}
                placeholder="Short description of your institute..."
                rows={3}
              />
            </div>
            <button className="btn btn-block" disabled={savingInfo}>
              {savingInfo ? <span className="spinner" /> : 'Save details'}
            </button>
            {saved && <div className="empty" style={{ marginTop: 10 }}>Saved successfully.</div>}
          </form>
        </div>

        <div className="card admin-form">
          <h4>Add a subject</h4>
          <form onSubmit={addSubject}>
            <div className="form-row">
              <label className="label">Subject name</label>
              <input
                className="input"
                required
                value={subjectForm.name}
                onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                placeholder="e.g. Data Structures"
              />
            </div>
            <div className="form-row">
              <label className="label">Code</label>
              <input
                className="input"
                value={subjectForm.code}
                onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                placeholder="e.g. CS-201"
              />
            </div>
            <div className="form-row">
              <label className="label">Description</label>
              <textarea
                className="input textarea"
                value={subjectForm.description}
                maxLength={500}
                onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })}
                placeholder="What is this subject about?"
                rows={3}
              />
            </div>
            <button className="btn btn-block" disabled={addingSubject || !subjectForm.name.trim()}>
              {addingSubject ? <span className="spinner" /> : 'Add subject'}
            </button>
          </form>
        </div>
      </div>

      <div className="card table-card" style={{ marginTop: 16 }}>
        <div style={{ padding: '12px 16px 4px' }}>
          <h4 style={{ margin: 0 }}>Subjects at {instituteName}</h4>
        </div>
        {subjects.length === 0 && <div className="empty">No subjects yet. Add your first subject above.</div>}
        {subjects.map((s) =>
          editingId === s._id ? (
            <div key={s._id} className="admin-row" style={{ alignItems: 'flex-start' }}>
              <div className="admin-row-main">
                <div className="form-row">
                  <input
                    className="input"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Subject name"
                  />
                </div>
                <div className="form-row">
                  <input
                    className="input"
                    value={editForm.code}
                    onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                    placeholder="Code"
                  />
                </div>
                <div className="form-row">
                  <textarea
                    className="input textarea"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button className="btn btn-sm" onClick={saveSubject}>Save</button>
                <button className="btn btn-outline btn-sm" onClick={cancelEdit}>Cancel</button>
              </div>
            </div>
          ) : (
            <div key={s._id} className="admin-row">
              <div className="admin-row-main">
                <div className="admin-row-name">
                  {s.name}
                  {s.code && <span className="muted">({s.code})</span>}
                </div>
                {s.description && <div className="muted">{s.description}</div>}
                <div className="muted">{s.institution ? `${s.institution} · ` : ''}added {timeAgo(s.createdAt)}</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => startEdit(s)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => deleteSubject(s)}>Delete</button>
            </div>
          )
        )}
      </div>
    </div>
  );
}