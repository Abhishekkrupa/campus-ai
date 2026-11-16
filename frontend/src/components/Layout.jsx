import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import './Layout.css';

const navItems = [
  { to: '/feed', label: 'Feed', icon: '🏠' },
  { to: '/explore', label: 'Explore', icon: '🧭' },
  { to: '/notes', label: 'Notes', icon: '📒' },
  { to: '/videos', label: 'Videos', icon: '🎬' },
  { to: '/articles', label: 'Articles', icon: '📰' },
  { to: '/ai', label: 'AI Assistant', icon: '🤖' },
  { to: '/messages', label: 'Messages', icon: '💬' },
  { to: '/notifications', label: 'Notifications', icon: '🔔' },
];

const mobileNav = [
  { to: '/feed', label: 'Home', icon: '🏠' },
  { to: '/explore', label: 'Explore', icon: '🧭' },
  { to: '/notes', label: 'Notes', icon: '📒' },
  { to: '/messages', label: 'Chat', icon: '💬' },
  { to: '/ai', label: 'AI', icon: '🤖' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <header className="navbar">
        <div className="navbar-inner container">
          <Link to="/feed" className="brand">
            <span className="brand-badge">C</span>
            <span>CampusAI</span>
          </Link>
          {user && (
            <form
              className="nav-search"
              onSubmit={(e) => {
                e.preventDefault();
                const q = e.target.q.value.trim();
                if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
              }}
            >
              <input name="q" placeholder="Search people, notes, videos..." className="input" />
            </form>
          )}
          <div className="nav-actions">
            {user && (
              <Link to="/messages" className="icon-btn" title="Messages">
                💬
              </Link>
            )}
            {user && (
              <div className="nav-user">
                <Link to={`/profile/${user.username}`} className="nav-avatar-link">
                  <Avatar user={user} size={34} />
                </Link>
                <button className="logout-btn" onClick={handleLogout} title="Logout">
                  🚪
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="container row layout-body">
        {user && (
          <aside className="sidebar">
            <nav className="sidebar-nav">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
              <div className="sidebar-divider" />
              {user.role === 'INSTITUTE' && (
                <NavLink to="/institute" className="sidebar-link">
                  <span className="sidebar-icon">🏫</span> Institute
                </NavLink>
              )}
              {user.role === 'CREATOR' && (
                <NavLink to="/creator" className="sidebar-link">
                  <span className="sidebar-icon">🎛️</span> Creator Studio
                </NavLink>
              )}
              {(user.role === 'SUPER_ADMIN' || user.role === 'MODERATOR') && (
                <NavLink to="/admin" className="sidebar-link">
                  <span className="sidebar-icon">🛡️</span> Admin Panel
                </NavLink>
              )}
            </nav>
          </aside>
        )}
        <main className="main">
          <Outlet />
        </main>
      </div>

      {user && (
        <nav className="mobile-nav">
          {mobileNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="mobile-nav-icon">{item.icon}</span>
              <span className="mobile-nav-label">{item.label}</span>
            </NavLink>
          ))}
          <NavLink
            to={`/profile/${user.username}`}
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="mobile-nav-icon">👤</span>
            <span className="mobile-nav-label">Profile</span>
          </NavLink>
          <button className="logout-btn mobile-logout-btn" onClick={handleLogout} title="Logout">
            🚪
            <span className="mobile-logout-label">Logout</span>
          </button>
        </nav>
      )}
    </div>
  );
}
