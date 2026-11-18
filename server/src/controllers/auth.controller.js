const authService = require('../services/auth.service');

async function registerCandidate(req, res, next) {
  try {
    const result = await authService.registerCandidate(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function registerRecruiter(req, res, next) {
  try {
    const result = await authService.registerRecruiter(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await authService.getMe(req.user.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

module.exports = { registerCandidate, registerRecruiter, login, me };
