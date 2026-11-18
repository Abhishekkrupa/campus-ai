// Authentication is shared with the main `protect` middleware so both the
// legacy and Prisma route families resolve identity from PostgreSQL only.
module.exports = require('./auth');
