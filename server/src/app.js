import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { prisma } from './db.js';
import { RENEW_HEADER, loadUser } from './middleware/auth.js';
import { errorHandler, notFound } from './utils/http.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import courseRoutes from './routes/courses.js';
import evaluationRoutes from './routes/evaluations.js';
import takeRoutes from './routes/take.js';
import attendanceRoutes from './routes/attendance.js';
import aiRoutes from './routes/ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render/Railway/Heroku están detrás de un proxy

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'img-src': ["'self'", 'data:', 'blob:'],
          'media-src': ["'self'", 'blob:'],
        },
      },
    }),
  );
  app.use(compression());
  if (config.corsOrigins.length) {
    app.use(cors({ origin: config.corsOrigins, exposedHeaders: [RENEW_HEADER, 'Content-Disposition'] }));
  }
  app.use(express.json({ limit: '1mb' }));

  // Salud del servicio (para el monitor de disponibilidad, RNF-04)
  app.get('/api/health', async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', db: 'ok', time: new Date() });
    } catch {
      res.status(503).json({ status: 'error', db: 'down' });
    }
  });

  app.use('/api', loadUser);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/take', takeRoutes);
  app.use('/api/courses', courseRoutes);
  app.use('/api', evaluationRoutes);
  app.use('/api', attendanceRoutes);
  app.use('/api', (req, res, next) => next(notFound('Ruta de API no encontrada')));

  // En producción el mismo servidor entrega el frontend compilado (una sola URL, sin CORS).
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { maxAge: '1h', index: false }));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
