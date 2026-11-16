import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import { VideoCard } from '../components/ResourceCard';
import './Videos.css';

export default function Videos() {
  const [params] = useSearchParams();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    videoUrl: '',
    thumbnail: '',
    duration: '',
    subject: '',
    department: '',
    tags: '',
  });

  const subject = params.get('subject') || '';
  const department = params.get('department') || '';
  const search = params.get('q') || '';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const q = {};
      if (subject) q.subject = subject;
      if (department) q.department = department;
      if (search) q.search = search;
      const { data } = await api.get('/videos', { params: q });
      setVideos(data);
    } catch (e) {
      setError(errorMessage(e, 'Could not load videos'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, department, search]);

  const create = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      const tags = form.tags
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);
      await api.post('/videos', { ...form, tags });
      setShowUpload(false);
      setForm({ title: '', description: '', videoUrl: '', thumbnail: '', duration: '', subject: '', department: '', tags: '' });
      load();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onForm = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="page">
      <div className="videos-head">
        <div>
          <h2 className="section-title">Videos</h2>
          <div className="muted">
            {search && `Results for "${search}" · `}
            {subject ? `Subject: ${subject} · ` : ''}
            {department ? `Department: ${department} · ` : ''}
            {videos.length} videos
          </div>
        </div>
        <button className="btn" onClick={() => setShowUpload(!showUpload)}>
          {showUpload ? '✕ Close' : '🎬 Upload video'}
        </button>
      </div>

      {showUpload && (
        <form className="card videos-upload" onSubmit={create}>
          <h3>Share a video</h3>
          <div className="grid grid-2">
            <div className="form-row">
              <label className="label">Title*</label>
              <input className="input" value={form.title} onChange={(e) => onForm('title', e.target.value)} required />
            </div>
            <div className="form-row">
              <label className="label">Subject</label>
              <input className="input" value={form.subject} onChange={(e) => onForm('subject', e.target.value)} placeholder="e.g. Data Structures" />
            </div>
          </div>
          <div className="grid grid-2">
            <div className="form-row">
              <label className="label">Video URL*</label>
              <input className="input" value={form.videoUrl} onChange={(e) => onForm('videoUrl', e.target.value)} placeholder="https://... / uploads/clip.mp4" />
            </div>
            <div className="form-row">
              <label className="label">Thumbnail URL</label>
              <input className="input" value={form.thumbnail} onChange={(e) => onForm('thumbnail', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-2">
            <div className="form-row">
              <label className="label">Duration (mm:ss)</label>
              <input className="input" value={form.duration} onChange={(e) => onForm('duration', e.target.value)} placeholder="12:30" />
            </div>
            <div className="form-row">
              <label className="label">Department</label>
              <input className="input" value={form.department} onChange={(e) => onForm('department', e.target.value)} placeholder="e.g. Electronics" />
            </div>
          </div>
          <div className="grid grid-2">
            <div className="form-row">
              <label className="label">Description</label>
              <textarea className="textarea" value={form.description} onChange={(e) => onForm('description', e.target.value)} />
            </div>
            <div className="form-row">
              <label className="label">Tags (comma separated)</label>
              <input className="input" value={form.tags} onChange={(e) => onForm('tags', e.target.value)} />
            </div>
          </div>
          <button className="btn" disabled={!form.title.trim() || submitting}>
            {submitting ? <span className="spinner" /> : 'Upload video'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="loading"><span className="spinner" /></div>
      ) : error ? (
        <div className="error-box">{error}</div>
      ) : videos.length === 0 ? (
        <div className="empty card">No videos found. Upload the first video!</div>
      ) : (
        <div className="grid grid-4">
          {videos.map((v) => (
            <VideoCard key={v._id} video={v} />
          ))}
        </div>
      )}
    </div>
  );
}