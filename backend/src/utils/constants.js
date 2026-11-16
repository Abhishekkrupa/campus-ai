module.exports = {
  roles: {
    STUDENT: 'STUDENT',
    CREATOR: 'CREATOR',
    MODERATOR: 'MODERATOR',
    SUPER_ADMIN: 'SUPER_ADMIN',
    INSTITUTE: 'INSTITUTE',
  },
  accountTypes: {
    STUDENT: 'STUDENT',
    CREATOR: 'CREATOR',
    INSTITUTE: 'INSTITUTE',
  },
  reportCategories: ['Spam', 'Harassment', 'Copyright concern', 'Misleading content', 'Inappropriate content', 'Other'],
  reportTargetTypes: ['Post', 'Comment', 'Video', 'Note', 'Profile', 'Message', 'Article'],
  relationStates: ['none', 'following', 'requested', 'connected', 'blocked'],
  notificationTypes: ['follower', 'connection_request', 'connection_accepted', 'post_like', 'comment', 'reply', 'share', 'message', 'creator_upload', 'ai_completed', 'admin', 'system'],
  notificationCategories: ['Social', 'Learning', 'Creator', 'System'],
  contentTypes: ['Post', 'Note', 'Video', 'Article', 'Quiz'],
};
