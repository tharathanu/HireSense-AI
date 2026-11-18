const prisma = require('../lib/prisma');
const { sendEmail } = require('../lib/mailer');

// Creates an in-app notification and (optionally) sends the same as an email.
// Email failures never break the main action.
async function notify(userId, { title, message, link, email = true }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  await prisma.notification.create({ data: { userId, title, message, link: link || null } });
  if (email) {
    sendEmail({ userId, to: user.email, subject: title, message, link }).catch(() => {});
  }
}

module.exports = { notify };
