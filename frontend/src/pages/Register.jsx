import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../api/client';
import { homePath } from '../utils/roles';
import './Auth.css';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    college: '',
    department: '',
    instituteName: '',
    accountType: 'STUDENT',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await register(form);
      navigate(homePath(user));
    } catch (err) {
      setError(errorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card auth-card-wide">
        <div className="auth-brand">
          <span className="auth-logo">C</span>
          <h1>Join CampusAI</h1>
          <p>Create your account to start learning and networking.</p>
        </div>
        <form onSubmit={submit}>
          {error && <div className="auth-error">{error}</div>}
          <div className="form-row">
            <label className="label">Full name</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label className="label">Username</label>
            <input
              className="input"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label className="label">Account type</label>
            <select
              className="select"
              value={form.accountType}
              onChange={(e) => setForm({ ...form, accountType: e.target.value })}
            >
              <option value="STUDENT">Student</option>
              <option value="CREATOR">Creator</option>
              <option value="INSTITUTE">Institute Authority</option>
            </select>
          </div>
          <div className="form-row">
            <label className="label">{form.accountType === 'INSTITUTE' ? 'Institute name' : 'College'}</label>
            <input
              className="input"
              required={form.accountType === 'INSTITUTE'}
              value={form.accountType === 'INSTITUTE' ? form.instituteName : form.college}
              onChange={(e) =>
                form.accountType === 'INSTITUTE'
                  ? setForm({ ...form, instituteName: e.target.value })
                  : setForm({ ...form, college: e.target.value })
              }
              placeholder={form.accountType === 'INSTITUTE' ? 'e.g. Greenfield Institute of Technology' : ''}
            />
          </div>
          {form.accountType === 'INSTITUTE' && (
            <div className="form-row">
              <label className="label">Department (optional)</label>
              <input
                className="input"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="e.g. Computer Science"
              />
            </div>
          )}
          <button className="btn btn-block" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Create account'}
          </button>
        </form>
        <div className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
