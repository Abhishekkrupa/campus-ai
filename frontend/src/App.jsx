import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Feed from './pages/Feed';
import Explore from './pages/Explore';
import Notes from './pages/Notes';
import NoteDetail from './pages/NoteDetail';
import Videos from './pages/Videos';
import VideoDetail from './pages/VideoDetail';
import Articles from './pages/Articles';
import AiAssistant from './pages/AiAssistant';
import Messages from './pages/Messages';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import CreatorDashboard from './pages/CreatorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import InstituteDashboard from './pages/InstituteDashboard';
import Search from './pages/Search';
import { homePath } from './utils/roles';

function Protected({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function RequireRole({ roles, children }) {
  const { user, token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (!user || !roles.includes(user.role)) return <Navigate to="/feed" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={homePath(user)} replace /> : <Login />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to={homePath(user)} replace /> : <Register />}
      />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/feed" element={<Feed />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/notes/:id" element={<NoteDetail />} />
        <Route path="/videos" element={<Videos />} />
        <Route path="/videos/:id" element={<VideoDetail />} />
        <Route path="/articles" element={<Articles />} />
        <Route path="/ai" element={<AiAssistant />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile/:username" element={<Profile />} />
        <Route
          path="/creator"
          element={
            <RequireRole roles={['CREATOR', 'SUPER_ADMIN', 'MODERATOR']}>
              <CreatorDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'MODERATOR']}>
              <AdminDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/institute"
          element={
            <RequireRole roles={['INSTITUTE']}>
              <InstituteDashboard />
            </RequireRole>
          }
        />
        <Route path="/search" element={<Search />} />
      </Route>
      <Route path="*" element={<Navigate to="/feed" replace />} />
    </Routes>
  );
}
