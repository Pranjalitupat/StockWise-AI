import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/error.js';
import routes from './routes/index.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientUrls, exposedHeaders: ['Content-Disposition'] }));
app.use(express.json({ limit: '100kb' }));

app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' } }));
app.use('/api/ai', rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many requests. Please wait a minute.' } }));

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

export default app;
