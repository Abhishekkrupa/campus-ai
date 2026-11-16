export const homePath = (user) => {
  if (!user) return '/login';
  switch (user.role) {
    case 'SUPER_ADMIN':
    case 'MODERATOR':
      return '/admin';
    case 'CREATOR':
      return '/creator';
    case 'INSTITUTE':
      return '/institute';
    default:
      return '/feed';
  }
};