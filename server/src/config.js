// Configuración centralizada: todo lo sensible viene de variables de entorno.
const env = process.env;

function required(name, fallbackForDev) {
  const value = env[name];
  if (value) return value;
  if (env.NODE_ENV !== 'production' && fallbackForDev !== undefined) return fallbackForDev;
  throw new Error(`Falta la variable de entorno ${name}`);
}

export const config = {
  env: env.NODE_ENV || 'development',
  isProd: env.NODE_ENV === 'production',
  port: Number(env.PORT || 4000),
  // URL pública del frontend; se usa para construir los enlaces del QR y las evaluaciones públicas.
  appUrl: (env.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  corsOrigins: (env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),

  jwtSecret: required('JWT_SECRET', 'dev-secret-cambiar-en-produccion'),
  // RNF-03: la sesión expira tras este periodo de inactividad (renovación deslizante).
  sessionIdleMinutes: Number(env.SESSION_IDLE_MINUTES || 30),

  gradeScale: Number(env.GRADE_SCALE || 5),
  passingGrade: Number(env.PASSING_GRADE || 3),

  ai: {
    anthropic: {
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.ANTHROPIC_MODEL || 'claude-opus-5',
    },
    openai: {
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL || 'gpt-5-mini',
    },
    gemini: {
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL || 'gemini-2.5-flash',
    },
    // Cualquier API compatible con OpenAI: DeepSeek, Groq, OpenRouter, Ollama, Mistral...
    compatible: {
      name: env.OPENAI_COMPAT_NAME || 'Compatible OpenAI',
      baseURL: env.OPENAI_COMPAT_BASE_URL,
      apiKey: env.OPENAI_COMPAT_API_KEY || 'no-key',
      model: env.OPENAI_COMPAT_MODEL,
    },
  },
};
