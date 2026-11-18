const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const HttpError = require('../utils/httpError');
const { signToken } = require('../utils/tokens');

const SALT_ROUNDS = 10;

// Removes the password hash before sending a user to the client
function publicUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

async function ensureEmailFree(email) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, 'An account with this email already exists.', {
      email: 'This email is already registered.',
    });
  }
}

async function registerCandidate({ fullName, email, password }) {
  await ensureEmailFree(email);
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      passwordHash,
      role: 'CANDIDATE',
      candidateProfile: { create: {} },
    },
  });

  return { user: publicUser(user), token: signToken(user) };
}

async function registerRecruiter({ fullName, email, password, companyName, designation, companyWebsite }) {
  await ensureEmailFree(email);
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      passwordHash,
      role: 'RECRUITER',
      recruiterProfile: {
        create: {
          designation: designation || null,
          company: {
            create: { name: companyName, website: companyWebsite || null },
          },
        },
      },
    },
  });

  return { user: publicUser(user), token: signToken(user) };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Same message for wrong email or wrong password, so attackers learn nothing
  const invalid = new HttpError(401, 'Incorrect email or password.');
  if (!user) throw invalid;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw invalid;
  if (!user.isActive) throw new HttpError(403, 'This account has been deactivated.');

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return { user: publicUser(updated), token: signToken(updated) };
}

async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      candidateProfile: true,
      recruiterProfile: { include: { company: true } },
    },
  });
  if (!user) throw new HttpError(404, 'User not found.');
  return publicUser(user);
}

module.exports = { registerCandidate, registerRecruiter, login, getMe, publicUser };
