// Auth API tests. Prisma is mocked so tests run without a database.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

jest.mock('../src/lib/prisma', () => require('./helpers/prismaMock').createPrismaMock());

const request = require('supertest');
const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { signToken } = require('../src/utils/tokens');

const baseUser = {
  id: 'user_1',
  email: 'asha.k@gmail.com',
  fullName: 'Asha K',
  role: 'CANDIDATE',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => prisma.__reset());

describe('GET /api/health', () => {
  it('reports the API is running', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('POST /api/auth/register/candidate', () => {
  it('creates a candidate and returns a token without the password hash', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ ...baseUser, passwordHash: 'hashed' });

    const res = await request(app).post('/api/auth/register/candidate').send({
      fullName: 'Asha K',
      email: 'Asha.K@gmail.com',
      password: 'Strong123',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.passwordHash).toBeUndefined();
    const created = prisma.user.create.mock.calls[0][0].data;
    expect(created.email).toBe('asha.k@gmail.com');
    expect(created.role).toBe('CANDIDATE');
    expect(created.passwordHash).not.toBe('Strong123');
  });

  it('rejects a weak password with a field message', async () => {
    const res = await request(app).post('/api/auth/register/candidate').send({
      fullName: 'Asha K',
      email: 'asha.k@gmail.com',
      password: 'short',
    });
    expect(res.status).toBe(400);
    expect(res.body.fields.password).toBeTruthy();
  });

  it('rejects an email that is already registered', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser });
    const res = await request(app).post('/api/auth/register/candidate').send({
      fullName: 'Asha K',
      email: 'asha.k@gmail.com',
      password: 'Strong123',
    });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/register/recruiter', () => {
  it('requires a company name', async () => {
    const res = await request(app).post('/api/auth/register/recruiter').send({
      fullName: 'Ravi M',
      email: 'ravi@company.in',
      password: 'Strong123',
    });
    expect(res.status).toBe(400);
    expect(res.body.fields.companyName).toBeTruthy();
  });

  it('creates a recruiter with a company', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ ...baseUser, role: 'RECRUITER', passwordHash: 'x' });
    const res = await request(app).post('/api/auth/register/recruiter').send({
      fullName: 'Ravi M',
      email: 'ravi@company.in',
      password: 'Strong123',
      companyName: 'Northwind Systems',
    });
    expect(res.status).toBe(201);
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.recruiterProfile.create.company.create.name).toBe('Northwind Systems');
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with the correct password', async () => {
    const passwordHash = await bcrypt.hash('Strong123', 4);
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash });
    prisma.user.update.mockResolvedValue({ ...baseUser, passwordHash });

    const res = await request(app).post('/api/auth/login').send({
      email: 'asha.k@gmail.com',
      password: 'Strong123',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('gives the same error for a wrong password or unknown email', async () => {
    const passwordHash = await bcrypt.hash('Strong123', 4);
    prisma.user.findUnique.mockResolvedValueOnce({ ...baseUser, passwordHash });
    const wrongPass = await request(app).post('/api/auth/login').send({ email: 'asha.k@gmail.com', password: 'Wrong123' });

    prisma.user.findUnique.mockResolvedValueOnce(null);
    const noUser = await request(app).post('/api/auth/login').send({ email: 'nobody@gmail.com', password: 'Wrong123' });

    expect(wrongPass.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPass.body.message).toBe(noUser.body.message);
  });

  it('blocks a deactivated account', async () => {
    const passwordHash = await bcrypt.hash('Strong123', 4);
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash, isActive: false });
    const res = await request(app).post('/api/auth/login').send({ email: 'asha.k@gmail.com', password: 'Strong123' });
    expect(res.status).toBe(403);
  });
});

describe('Protected routes', () => {
  it('rejects requests with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a tampered token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer abc.def.ghi');
    expect(res.status).toBe(401);
  });

  it('returns the logged-in user', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash: 'x' });
    const token = signToken(baseUser);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(baseUser.email);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('stops a candidate from opening the admin dashboard', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash: 'x' });
    const token = signToken(baseUser);
    const res = await request(app).get('/api/dashboard/admin').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
