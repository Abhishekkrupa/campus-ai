import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { NoteCard } from '../components/ResourceCard';
import { formatBytes } from '../utils/format';
import { isAllowedNoteFile } from '../utils/attachments';
import './Notes.css';

const EMPTY_FORM = {
  title: '',
  description: '',
  subject: '',
  department: '',
  fileUrl: '',
  fileType: 'pdf',
  tags: '',
};

export default function Notes() {
  const [params] = useSearchParams();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('latest');
  const [showUpload, setShowUpload] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState(null);
  const [storage, setStorage] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const fileRef = useRef(null);

  const subject = params.get('subject') || '';
  const department = params.get('department') || '';
  const search = params.get('q') || '';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const q = { sort };
      if (subject) q.subject = subject;
      if (department) q.department = department;
      if (search) q.search = search;
      const { data } = await api.get('/notes', { params: q });
      setNotes(data);
    } catch (e) {
      setError(errorMessage(e, 'Could not load notes'));
    } finally {
      setLoading(false);
    }
  };

  const loadStorage = async () => {
    try {
      const { data } = await api.get('/notes/storage');
      setStorage(data.storage);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    load();
    loadStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, subject, department, search]);

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (!isAllowedNoteFile(f.type)) {
      alert('Unsupported file type. Allowed: PDF, Word, PowerPoint, text, markdown and images.');
      return;
    }
    setFile(f);
  };

  const create = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const tags = form.tags
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);
    if (!file && !form.fileUrl.trim()) {
      alert('Choose a file or enter a file URL.');
      return;
    }
    setSubmitting(true);
    try {
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('title', form.title.trim());
        fd.append('description', form.description);
        fd.append('subject', form.subject);
        fd.append('department', form.department);
        fd.append('tags', JSON.stringify(tags));
        await api.post('/notes/upload', fd);
      } else {
        await api.post('/notes', { ...form, tags, fileSize: 0, pageCount: 0 });
      }
      setShowUpload(false);
      setFile(null);
      setForm(EMPTY_FORM);
      load();
      loadStorage();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onForm = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const used = storage?.used || 0;
  const limit = storage?.limit || 0;
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  return (
    <div className="page">
      <div className="notes-head">
        <div>
          <h2 className="section-title">Notes</h2>
          <div className="muted">
            {search && `Results for "${search}" · `}
            {subject ? `Subject: ${subject} · ` : ''}
            {department ? `Department: ${department} · ` : ''}
            {notes.length} notes
          </div>
        </div>
        <button className="btn" onClick={() => setShowUpload(!showUpload)}>
          {showUpload ? '✕ Close' : '⬆ Upload note'}
        </button>
      </div>

      {storage && (
        <div className="card storage-card">
          <div className="storage-info">
            <span className="storage-label">📦 My storage</span>
            <span className="muted">
              {formatBytes(used)} of {formatBytes(limit)} used
            </span>
          </div>
          <div className="storage-bar">
            <div className="storage-fill" style={{ width: `${pct}%` }} />
          </div>
          {pct >= 100 ? (
            <div className="storage-warn">Storage is full — delete some notes to free up space.</div>
          ) : pct >= 80 ? (
            <div className="storage-warn">You are close to your storage limit ({formatBytes(limit - used)} left).</div>
          ) : (
            <div className="storage-hint">Each student gets {formatBytes(limit)} of free storage for notes, PDFs, documents and PPTs.</div>
          )}
        </div>
      )}

      <div className="feed-tabs">
        {[
          { v: 'latest', l: '🕒 Latest' },
          { v: 'popular', l: '⬇ Most downloaded' },
          { v: 'trending', l: '👁 Most viewed' },
        ].map((t) => (
          <button
            key={t.v}
            className={`compose-tab ${sort === t.v ? 'active' : ''}`}
            onClick={() => setSort(t.v)}
          >
            {t.l}
          </button>
        ))}
      </div>

      {showUpload && (
        <form className="card notes-upload" onSubmit={create}>
          <h3>Share a note</h3>
          <div className="grid grid-2">
            <div className="form-row">
              <label className="label">Title*</label>
              <input className="input" value={form.title} onChange={(e) => onForm('title', e.target.value)} required />
            </div>
            <div className="form-row">
              <label className="label">Subject</label>
              <input className="input" value={form.subject} onChange={(e) => onForm('subject', e.target.value)} placeholder="e.g. Operating Systems" />
            </div>
          </div>
          <div className="form-row">
            <label className="label">Description</label>
            <textarea className="textarea" value={form.description} onChange={(e) => onForm('description', e.target.value)} />
          </div>
          <div className="form-row">
            <label className="label">File (PDF, Word, PowerPoint, text or image)</label>
            <input ref={fileRef} type="file" className="note-file-input" hidden accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.rtf,image/*" onChange={onFile} />
            {file ? (
              <div className="file-chip">
                <span className="file-chip-name">{file.name}</span>
                <span className="muted file-chip-size">{formatBytes(file.size)}</span>
                <button type="button" className="file-chip-remove" title="Remove file" onClick={() => setFile(null)}>
                  ×
                </button>
              </div>
            ) : (
              <div className="note-file-row">
                <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
                  📎 Choose file
                </button>
                <span className="muted">or paste a URL below</span>
              </div>
            )}
          </div>
          {!file && (
            <div className="form-row">
              <label className="label">File URL (for external/cloud links)</label>
              <input className="input" value={form.fileUrl} onChange={(e) => onForm('fileUrl', e.target.value)} placeholder="https://... / uploads/note.pdf" />
            </div>
          )}
          <div className="grid grid-3">
            <div className="form-row">
              <label className="label">Type</label>
              <select className="select" value={form.fileType} onChange={(e) => onForm('fileType', e.target.value)}>
                {['pdf', 'doc', 'ppt', 'txt', 'md'].map((t) => (
                  <option key={t} value={t}>{t.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="label">Department</label>
              <input className="input" value={form.department} onChange={(e) => onForm('department', e.target.value)} placeholder="e.g. Computer Science" />
            </div>
            <div className="form-row">
              <label className="label">Tags (comma separated)</label>
              <input className="input" value={form.tags} onChange={(e) => onForm('tags', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <button className="btn btn-block" disabled={!form.title.trim() || submitting || (!file && !form.fileUrl.trim())}>
              {submitting ? <span className="spinner" /> : 'Upload note'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="loading"><span className="spinner" /></div>
      ) : error ? (
        <div className="error-box">{error}</div>
      ) : notes.length === 0 ? (
        <div className="empty card">No notes found. Upload the first note!</div>
      ) : (
        <div className="grid grid-4">
          {notes.map((n) => (
            <NoteCard key={n._id} note={n} />
          ))}
        </div>
      )}
    </div>
  );
}