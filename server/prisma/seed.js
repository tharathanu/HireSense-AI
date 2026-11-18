// Creates the first admin account and the base skill list.
// Run with: npm run db:seed   (safe to run more than once)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const { QUESTIONS, TOPICS } = require('./seed-data');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const SKILLS = {
  Languages: ['JavaScript', 'TypeScript', 'Python', 'Java', 'C', 'C++', 'C#', 'Go', 'SQL', 'Kotlin', 'Swift', 'PHP'],
  Frontend: ['React', 'Angular', 'Vue.js', 'Next.js', 'HTML', 'CSS', 'Tailwind CSS', 'Redux'],
  Backend: ['Node.js', 'Express.js', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'REST APIs', 'GraphQL'],
  Databases: ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Prisma', 'Firebase'],
  Cloud: ['AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'CI/CD', 'Linux'],
  Data: ['Machine Learning', 'Data Analysis', 'Pandas', 'NumPy', 'TensorFlow', 'Power BI', 'Excel'],
  Tools: ['Git', 'GitHub', 'Postman', 'Jest', 'Figma', 'Jira'],
  Professional: ['Communication', 'Teamwork', 'Problem Solving', 'Leadership'],
};

async function main() {
  for (const [category, names] of Object.entries(SKILLS)) {
    for (const name of names) {
      await prisma.skill.upsert({ where: { name }, update: { category }, create: { name, category } });
    }
  }
  console.log('Skills ready.');

  // Starter question bank and GD topics (only added once)
  if ((await prisma.aptitudeQuestion.count()) === 0) {
    await prisma.aptitudeQuestion.createMany({ data: QUESTIONS });
    console.log(`${QUESTIONS.length} aptitude questions added.`);
  }
  if ((await prisma.gDTopic.count()) === 0) {
    await prisma.gDTopic.createMany({ data: TOPICS });
    console.log(`${TOPICS.length} discussion topics added.`);
  }

  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log('ADMIN_EMAIL / ADMIN_PASSWORD not set - skipping admin account.');
    return;
  }

  const email = ADMIN_EMAIL.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin ${email} already exists.`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      fullName: ADMIN_NAME || 'HireSense Admin',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
    },
  });
  console.log(`Admin account created for ${email}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
