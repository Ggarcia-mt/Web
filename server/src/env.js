// Carga server/.env en desarrollo. En producción las variables vienen del hosting.
// Debe importarse antes que cualquier otro módulo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env');
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
