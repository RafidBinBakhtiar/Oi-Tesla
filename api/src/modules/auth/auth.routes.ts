import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import { authOf, requireRole } from '../../middleware/auth';
import { DriverSignupSchema, LoginSchema, SignupSchema } from './auth.schemas';
import * as auth from './auth.service';

export const authRouter = Router();

// Slow down password guessing. Generous enough for a live demo.
const credentialLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.NODE_ENV === 'test' ? 1_000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again in a minute' } },
});

authRouter.post('/passengers/signup', credentialLimiter, async (req, res) => {
  const body = SignupSchema.parse(req.body);
  res.status(201).json(await auth.signupPassenger(body));
});

authRouter.post('/passengers/login', credentialLimiter, async (req, res) => {
  const { phoneNumber, password } = LoginSchema.parse(req.body);
  res.json(await auth.loginPassenger(phoneNumber, password));
});

authRouter.post('/drivers/signup', credentialLimiter, async (req, res) => {
  const body = DriverSignupSchema.parse(req.body);
  res.status(201).json(await auth.signupDriver(body));
});

authRouter.post('/drivers/login', credentialLimiter, async (req, res) => {
  const { phoneNumber, password } = LoginSchema.parse(req.body);
  res.json(await auth.loginDriver(phoneNumber, password));
});

authRouter.get('/me', requireRole('passenger', 'driver'), async (req, res) => {
  res.json(await auth.getProfile(authOf(req)));
});
