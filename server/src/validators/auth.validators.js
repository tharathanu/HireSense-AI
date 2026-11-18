const { z } = require('zod');

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password is too long.')
  .regex(/[A-Za-z]/, 'Password must contain a letter.')
  .regex(/[0-9]/, 'Password must contain a number.');

const base = {
  fullName: z.string().trim().min(2, 'Enter your full name.').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password,
};

const registerCandidateSchema = z.object({ ...base });

const registerRecruiterSchema = z.object({
  ...base,
  companyName: z.string().trim().min(2, 'Enter your company name.').max(120),
  designation: z.string().trim().max(80).optional(),
  companyWebsite: z.string().trim().url('Enter a valid website link.').optional().or(z.literal('')),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

module.exports = { registerCandidateSchema, registerRecruiterSchema, loginSchema };
