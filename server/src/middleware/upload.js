import multer from 'multer';
import { badRequest } from '../utils/http.js';

// Archivos Excel en memoria (máx. 5 MB); nunca se guardan en disco.
export const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.xlsx$/i.test(file.originalname);
    cb(ok ? null : badRequest('Solo se permiten archivos .xlsx'), ok);
  },
}).single('file');

export function requireFile(req) {
  if (!req.file) throw badRequest('Adjunta un archivo .xlsx en el campo "file"');
  return req.file.buffer;
}
