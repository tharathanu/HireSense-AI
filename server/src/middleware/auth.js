const prisma = require('../lib/prisma');
const HttpError = require('../utils/httpError');
const { verifyToken } = require('../utils/tokens');

// Checks the "Authorization: Bearer <token>" header and loads the user
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new HttpError(401, 'Please log in to continue.');
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new HttpError(401, 'Your session has expired. Please log in again.');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new HttpError(401, 'This account is not active.');
    }

    req.user = { id: user.id, role: user.role, email: user.email, fullName: user.fullName };
    next();
  } catch (err) {
    next(err);
  }
}

// Allows only the listed roles, e.g. requireRole('RECRUITER', 'ADMIN')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HttpError(403, 'You do not have access to this page.'));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
