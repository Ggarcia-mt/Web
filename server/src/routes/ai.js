import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import { generateQuestions, listProviders } from '../services/ai/index.js';
import { parse } from '../utils/http.js';

const router = Router();
router.use(requireRole('PROFESOR', 'ADMIN'));

// Controla el gasto en las APIs de IA: 20 generaciones cada 10 minutos por usuario.
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => `user-${req.user.id}`,
  message: { error: 'Llegaste al límite de generaciones con IA; espera unos minutos' },
});

router.get('/providers', (req, res) => {
  res.json({ providers: listProviders() });
});

router.post('/generate', aiLimiter, async (req, res) => {
  const data = parse(
    z.object({
      provider: z.string(),
      topic: z.string().trim().min(3).max(2000),
      level: z.string().trim().min(2).max(100).default('Intermedio'),
      count: z.number().int().min(1).max(20).default(5),
      questionType: z.enum(['MULTIPLE', 'COMPLETAR', 'MIXTO']).default('MIXTO'),
      instructions: z.string().trim().max(2000).optional(),
    }),
    req.body,
  );
  res.json(await generateQuestions(data));
});

export default router;
