# CampusPoli

Plataforma web adaptativa para crear evaluaciones asistidas por IA, calificar de forma flexible y controlar la asistencia con QR dinámico o ventana de horario.

Proyecto Pedagógico Integrador — Construcción de Elementos de Software Web · Politécnico Colombiano Jaime Isaza Cadavid · 2026.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite + Tailwind CSS 4 + React Router (responsive, mobile first) |
| Backend | Node.js + Express 5 (API REST) |
| Base de datos | PostgreSQL + Prisma ORM (migraciones versionadas) |
| IA | Motor agnóstico: Claude (Anthropic), ChatGPT (OpenAI), Gemini (Google) y cualquier API compatible con OpenAI (DeepSeek, Groq, OpenRouter, Ollama…) |
| Excel | ExcelJS (.xlsx) |
| QR | `qrcode` (servidor) + `html5-qrcode` (cámara del celular) |
| Seguridad | bcrypt, JWT con expiración por inactividad, Helmet, rate limiting |

```
Web/
├─ server/                 API Express
│  ├─ prisma/schema.prisma Modelo de datos (usuarios, cursos, evaluaciones, preguntas, intentos, asistencia)
│  ├─ prisma/migrations/   Migraciones SQL
│  ├─ prisma/seed.js       Administrador inicial y datos de demostración
│  ├─ src/routes/          auth, users, courses, evaluations, take, attendance, ai
│  ├─ src/services/        ai/ (proveedores), excel, gradebook, grader, access
│  ├─ src/utils/           grading (calificación), qr (tokens rotativos)
│  └─ test/                Pruebas unitarias (node --test)
├─ client/                 Frontend React
│  └─ src/pages/           Pantallas por rol
├─ Dockerfile              Imagen de producción (API + frontend)
└─ render.yaml             Despliegue en un clic en Render
```

## Requisitos implementados

| Código | Requisito | Dónde |
|---|---|---|
| RF-01 | Autenticación y 5 perfiles: Administrador, Profesor, Estudiante de curso, Estudiante independiente y Usuario sin autenticar | `server/src/routes/auth.js`, `middleware/auth.js`, `client/src/App.jsx` |
| RF-02 | Evaluaciones de selección múltiple y completar, manuales, con IA o importadas de Excel | `routes/evaluations.js`, `services/ai/`, `pages/EvaluationEditor.jsx` |
| RF-03 | Puntaje por pregunta, peso (%) por evaluación, asignación a todo el curso, a estudiantes específicos o pública con enlace | `routes/evaluations.js` |
| RF-04 | Asistencia dual: QR que rota cada 15/30/60 s o ventana de horario | `routes/attendance.js`, `utils/qr.js`, `pages/AttendanceLive.jsx`, `pages/ScanAttendance.jsx` |
| RF-05 | Calificación automática, ajuste por pregunta, puntos adicionales, retroalimentación y recálculo si se corrige la clave | `services/grader.js`, `pages/SubmissionReview.jsx` |
| RF-06 | Importar estudiantes, usuarios y preguntas; exportar notas, asistencia, resultados y usuarios a .xlsx | `services/excel.js` |
| RNF-01 | Interfaz responsive: barra lateral en escritorio y navegación inferior en celular | `components/Layout.jsx` |
| RNF-02 | Validación del QR por HMAC en memoria (~10-20 ms por solicitud) | `utils/qr.js` |
| RNF-03 | Contraseñas con bcrypt; la sesión expira tras `SESSION_IDLE_MINUTES` sin actividad (servidor y navegador) | `middleware/auth.js`, `lib/auth.jsx` |
| RNF-04 | Endpoint de salud `/api/health` para monitoreo; despliegue con health check | `app.js`, `render.yaml` |

### Roles

- **Administrador**: gestiona usuarios (crear, editar, activar/desactivar, restablecer clave, importar/exportar Excel), ve estadísticas y el estado de los proveedores de IA, y administra cualquier curso.
- **Profesor**: crea cursos, inscribe estudiantes (código, correo o Excel), crea evaluaciones con IA, toma asistencia, ajusta notas y exporta reportes.
- **Estudiante de curso**: presenta evaluaciones, marca asistencia y ve sus notas y su asistencia acumuladas.
- **Estudiante independiente**: se registra por su cuenta, presenta evaluaciones públicas y puede unirse a un curso con código (entonces pasa a ser estudiante de curso).
- **Usuario sin autenticar**: presenta evaluaciones públicas desde un enlace (`/e/CODIGO`) indicando su nombre.

### Calificación

- Nota de una evaluación = `puntos obtenidos / puntos posibles × GRADE_SCALE` + puntos adicionales, sin pasar del máximo (por defecto la escala es de 0 a 5).
- Las respuestas de completar se comparan sin tildes, mayúsculas ni puntuación y aceptan varias respuestas válidas.
- Nota acumulada del curso = Σ(nota × peso%) / 100. También se muestra el promedio proyectado sobre lo ya evaluado. Una evaluación cerrada sin presentar cuenta 0.

## Ejecutar en local

Requisitos: **Node.js 20.12 o superior** (se recomienda 22 LTS).

```bash
npm install                     # instala server y client (npm workspaces)
cp server/.env.example server/.env

# Terminal 1: PostgreSQL local sin instalar nada (queda en server/.pgdata)
npm run db:local

# Terminal 2: crear tablas y datos de ejemplo
npm run db:migrate              # aplica las migraciones
SEED_DEMO=true npm run db:seed  # en PowerShell: $env:SEED_DEMO='true'; npm run db:seed
npm run dev                     # API en :4000 y web en http://localhost:5173
```

Si prefieres otro PostgreSQL (instalado, Docker, Neon o Supabase), solo cambia `DATABASE_URL` en `server/.env`.

Cuentas de demostración (`SEED_DEMO=true`):

| Rol | Correo | Clave |
|---|---|---|
| Administrador | admin@campuspoli.edu.co | Admin12345 |
| Profesor | profesor@campuspoli.edu.co | Profesor123 |
| Estudiante de curso | estudiante1@campuspoli.edu.co (1 a 4) | Estudiante123 |
| Estudiante independiente | independiente@campuspoli.edu.co | Estudiante123 |

Código del curso demo: `WEB2026`.

**Probar el QR con el celular**: la cámara del navegador solo funciona con HTTPS o en `localhost`. En local, abre `http://<IP-de-tu-PC>:5173` desde el celular y usa el **código manual** que aparece debajo del QR, o despliega la app (Render da HTTPS) para usar la cámara.

### Pruebas

```bash
npm test          # pruebas unitarias de calificación, QR e IA
```

## Configurar la IA

Configura al menos un proveedor en las variables de entorno del servidor. Los profesores solo ven los que tengan clave.

| Proveedor | Variables | Clave en |
|---|---|---|
| Claude | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (por defecto `claude-opus-5`) | console.anthropic.com |
| ChatGPT | `OPENAI_API_KEY`, `OPENAI_MODEL` | platform.openai.com |
| Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL` | aistudio.google.com |
| Compatible con OpenAI | `OPENAI_COMPAT_BASE_URL`, `OPENAI_COMPAT_API_KEY`, `OPENAI_COMPAT_MODEL`, `OPENAI_COMPAT_NAME` | DeepSeek, Groq, OpenRouter, Ollama… |

Revisa en la documentación de cada proveedor que el nombre del modelo siga vigente. Para agregar otro proveedor, añade una entrada en `server/src/services/ai/providers.js`. Las preguntas generadas siempre pasan por el editor para que el profesor las revise antes de publicar. Cada profesor puede hacer como máximo 20 generaciones cada 10 minutos.

## Despliegue

### Opción A: Render (recomendada, gratis para empezar)

1. Sube el repositorio a GitHub.
2. En [Render](https://render.com), elige **New → Blueprint** y selecciona el repositorio; Render lee `render.yaml` y crea la base de datos PostgreSQL y el servicio web.
3. Completa las variables que pide: `APP_URL` (la URL que te asigna Render, por ejemplo `https://campuspoli.onrender.com`), `ADMIN_EMAIL`, `ADMIN_PASSWORD` y las claves de IA.
4. En cada despliegue, `npm start` aplica las migraciones (`prisma migrate deploy`), crea el administrador si no existe y arranca el servidor, que también entrega el frontend.

> En el plan gratuito de Render el servicio se duerme tras 15 minutos sin uso y la base de datos gratuita vence a los 30 días. Para el periodo lectivo (RNF-04, 99% de disponibilidad) usa un plan pago o una base de datos externa (Neon o Supabase) pegando su cadena en `DATABASE_URL`.

### Opción B: Docker (cualquier VPS, Railway, Fly.io…)

```bash
docker build -t campuspoli .
docker run -p 4000:4000 \
  -e DATABASE_URL="postgresql://usuario:clave@host:5432/campuspoli" \
  -e JWT_SECRET="un-secreto-largo" \
  -e APP_URL="https://tu-dominio.com" \
  -e ADMIN_EMAIL="admin@tu-dominio.com" -e ADMIN_PASSWORD="ClaveSegura123" \
  campuspoli
```

### Variables de entorno de producción

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión de PostgreSQL |
| `JWT_SECRET` | Sí | Secreto largo y aleatorio para firmar sesiones |
| `APP_URL` | Sí | URL pública; se usa en los QR y en los enlaces públicos |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Primer despliegue | Crean el administrador inicial |
| `SESSION_IDLE_MINUTES` | No (30) | Minutos de inactividad antes de cerrar la sesión |
| `GRADE_SCALE` / `PASSING_GRADE` | No (5 / 3) | Escala de notas y nota aprobatoria |
| Claves de IA | Al menos una | Ver *Configurar la IA* |
| `CORS_ORIGINS` | No | Solo si el frontend se publica en otro dominio (y entonces `VITE_API_URL` en el build del cliente) |

## API (resumen)

| Método | Ruta | Rol |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | Público |
| GET/PUT | `/api/auth/me`, PUT `/api/auth/password` | Autenticado |
| GET/POST/PUT/DELETE | `/api/users…`, `/api/users/stats`, `/import`, `/export.xlsx` | Admin |
| GET/POST | `/api/courses`, `/api/courses/join` | Según rol |
| GET/POST/DELETE | `/api/courses/:id/students…`, `/students/import` | Profesor |
| GET | `/api/courses/:id/gradebook`, `/export/grades.xlsx`, `/export/attendance.xlsx` | Profesor (el estudiante ve solo su fila) |
| GET/POST | `/api/courses/:id/evaluations` | Según rol |
| GET/PUT/DELETE | `/api/evaluations/:id`, `/questions`, `/status`, `/submissions`, `/export.xlsx` | Profesor |
| POST | `/api/ai/generate`, GET `/api/ai/providers` | Profesor |
| POST | `/api/take/:evaluationId/start`, `/api/take/public/:code/start` | Estudiante / anónimo |
| GET/PUT/POST | `/api/take/submissions/:id`, `/answers`, `/submit` | Dueño del intento |
| PUT | `/api/submissions/:id/grade` | Profesor |
| GET/POST | `/api/courses/:id/attendance`, `/api/attendance/sessions/:id/qr` | Profesor |
| POST | `/api/attendance/scan`, `/api/attendance/sessions/:id/check-in` | Estudiante |
| GET | `/api/health` | Público |
