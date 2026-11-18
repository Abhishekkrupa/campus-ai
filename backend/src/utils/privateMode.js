const { roles } = require('./constants');

// Server-side truth for the temporary private deployment.
// The frontend never decides who is an admin; every request is checked
// against the user record loaded from PostgreSQL.
const PRIVATE_MODE_DENIED_CODE = 'PRIVATE_MODE_ADMIN_REQUIRED';
const PRIVATE_MODE_DENIED_MESSAGE =
  'Private Admin Access: this deployment is restricted to verified super administrators.';
const PRIVATE_MODE_REGISTRATION_CODE = 'PRIVATE_MODE_REGISTRATION_DISABLED';
const PRIVATE_MODE_REGISTRATION_MESSAGE =
  'Private Admin Access: public registration is disabled.';

/**
 * Parse ADMIN_ONLY_MODE defensively. Only the exact value "true"
 * (ignoring case/whitespace) enables private mode; anything else keeps
 * the normal public behaviour.
 */
const isAdminOnlyMode = (value) =>
  typeof value === 'string' && value.trim().toLowerCase() === 'true';

/**
 * A verified super-admin is identified exclusively from the database row:
 * role, active status and the existing verification flags. Token claims and
 * frontend-supplied role values are deliberately ignored.
 */
const isVerifiedSuperAdmin = (user) =>
  Boolean(user) &&
  user.role === roles.SUPER_ADMIN &&
  user.status === 'active' &&
  user.isVerified === true &&
  user.verificationStatus === 'approved';

module.exports = {
  isAdminOnlyMode,
  isVerifiedSuperAdmin,
  PRIVATE_MODE_DENIED_CODE,
  PRIVATE_MODE_DENIED_MESSAGE,
  PRIVATE_MODE_REGISTRATION_CODE,
  PRIVATE_MODE_REGISTRATION_MESSAGE,
};
