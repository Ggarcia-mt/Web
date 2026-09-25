import './env.js';
import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`CampusPoli API escuchando en http://localhost:${config.port} (${config.env})`);
});

async function shutdown(signal) {
  console.log(`${signal} recibido, cerrando...`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
