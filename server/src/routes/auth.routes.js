const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const {
  registerCandidateSchema,
  registerRecruiterSchema,
  loginSchema,
} = require('../validators/auth.validators');

const router = express.Router();

// Slows down password-guessing attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please wait a few minutes and try again.' },
});

router.post('/register/candidate', authLimiter, validate(registerCandidateSchema), controller.registerCandidate);
router.post('/register/recruiter', authLimiter, validate(registerRecruiterSchema), controller.registerRecruiter);
router.post('/login', authLimiter, validate(loginSchema), controller.login);
router.get('/me', requireAuth, controller.me);

module.exports = router;
