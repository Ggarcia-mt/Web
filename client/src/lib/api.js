// Cliente HTTP: agrega el token, lo renueva (sesión deslizante) y avisa si la sesión expira.
const TOKEN_KEY = 'campuspoli_token';
const BASE = import.meta.env.VITE_API_URL || '/api';

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* almacenamiento no disponible */
    }
  },
};

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, guestToken, raw = false } = {}) {
  const token = tokenStore.get();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (guestToken) headers['X-Guest-Token'] = guestToken;
  const isForm = body instanceof FormData;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: isForm ? body : body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'No hay conexión con el servidor');
  }

  const renewed = res.headers.get('X-Session-Token');
  if (renewed) tokenStore.set(renewed);

  if (res.status === 401 && token) {
    tokenStore.set(null);
    window.dispatchEvent(new CustomEvent('session-expired'));
  }

  if (raw) {
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(res.status, data.error || 'Error en la descarga');
    }
    return res;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Error ${res.status}`, data.details);
  return data;
}

export const api = {
  get: (path, opts) => request(path, opts),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
  upload: (path, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request(path, { method: 'POST', body: fd });
  },
  /** Descarga un archivo protegido (Excel) y lo guarda en el equipo. */
  download: async (path, fallbackName) => {
    const res = await request(path, { raw: true });
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const name = disposition.match(/filename="?([^"]+)"?/)?.[1] || fallbackName;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
