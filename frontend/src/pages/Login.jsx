import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePrivateMode } from '../context/PrivateModeContext';
import { errorMessage } from '../api/client';
import { homePath } from '../utils/roles';
import './Auth.css';

export default function Login() {
  const { login } = useAuth();
  const { privateMode } = usePrivateMode();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate(homePath(user));
    } catch (err) {
      setError(errorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card auth-float">
        <div className="auth-brand">
          <span className="auth-logo">C</span>
          <h1>{privateMode ? 'Private Admin Access' : 'Welcome back'}</h1>
          <p>
            {privateMode
              ? 'Sign in with your verified administrator account.'
              : 'Learn, connect and grow on campus.'}
          </p>
        </div>
        <form onSubmit={submit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}
          <div className="form-row">
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@campus.edu"
            />
          </div>
          <div className="form-row">
            <label className="label">Password</label>
            <div className="pw-wrap">
              <input
                className="input"
                type={showPw ? 'text' : 'password'}
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
              />
              <button type="button" className="pw-toggle" onClick={() => setShowPw((s) => !s)} title={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <button className="btn btn-block btn-login" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner spinner-light" />
                Signing in...
              </>
            ) : (
              <>
                Sign in
                <span className="btn-arrow">→</span>
              </>
            )}
          </button>
        </form>
        {privateMode ? (
          <div className="auth-private-notice">
            <strong>Private Admin Access</strong>
            <p>Registration is disabled. Only verified super administrators can sign in.</p>
          </div>
        ) : (
          <div className="auth-switch">
            New here? <Link to="/register">Create an account</Link>
          </div>
        )}
        {!privateMode && (
          <div className="auth-institute">
            <span className="auth-institute-icon">🏫</span>
            <div className="auth-institute-text">
              <div className="auth-institute-title">Institute Authority?</div>
              <div className="auth-institute-sub">Manage your institute name, departments and subjects on CampusAI.</div>
            </div>
            <Link to="/register" className="btn btn-sm">Sign up</Link>
          </div>
        )}
      </div>
    </div>
  );
}
