// Developer logging with throttling, so a repeating fault cannot flood the
// content log. Each key logs at most once per `windowMs` (default 30 s).
const lastLogged = new Map();

export function warnOnce(key, message, windowMs = 30000) {
  const now = Date.now();
  const last = lastLogged.get(key) ?? 0;
  if (now - last < windowMs) return;
  lastLogged.set(key, now);
  console.warn(`[SpiderMan] ${key}: ${message}`);
}

export function errorOnce(key, error, windowMs = 30000) {
  const text = error && error.stack ? error.stack : String(error);
  warnOnce(key, text, windowMs);
}
