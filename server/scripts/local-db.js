// PostgreSQL local SIN instalar nada (solo para desarrollo).
// Descarga un binario de PostgreSQL vía npm y lo ejecuta en server/.pgdata.
// Deja esta terminal abierta mientras trabajas. DATABASE_URL:
//   postgresql://campuspoli:campuspoli@localhost:5433/campuspoli
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.pgdata');
const firstRun = !fs.existsSync(dir);

const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: 'campuspoli',
  password: 'campuspoli',
  port: 5433,
  persistent: true,
});

if (firstRun) await pg.initialise();
await pg.start();
if (firstRun) await pg.createDatabase('campuspoli');

console.log('PostgreSQL local listo en postgresql://campuspoli:campuspoli@localhost:5433/campuspoli');
console.log('Presiona Ctrl+C para detenerlo.');

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
