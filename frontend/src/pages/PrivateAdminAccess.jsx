import { Link } from 'react-router-dom';
import './Auth.css';

export default function PrivateAdminAccess() {
  return (
    <div className="auth-page">
      <div className="auth-card card auth-float">
        <div className="auth-brand">
          <span className="auth-logo">C</span>
          <h1>Private Admin Access</h1>
          <p>Public signup is temporarily disabled.</p>
        </div>
        <div className="auth-private-notice">
          <strong>Restricted deployment</strong>
          <p>
            Campus AI is currently available only to verified super administrators.
            New accounts cannot be created and existing non-admin sessions are blocked.
          </p>
        </div>
        <div className="auth-switch">
          Already have administrator access? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
