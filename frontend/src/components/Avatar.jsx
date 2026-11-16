import { avatarColor, initials } from '../utils/format';

export default function Avatar({ user, size = 36 }) {
  if (user && user.avatar) {
    return (
      <img
        className="avatar"
        style={{ width: size, height: size }}
        src={user.avatar}
        alt={user.name || 'avatar'}
      />
    );
  }
  return (
    <div
      className="avatar avatar-fallback"
      style={{ width: size, height: size, background: avatarColor(user && user.name) }}
    >
      {initials(user && user.name)}
    </div>
  );
}
