// Static hosts (Vercel) can't run the API, so the frontend there calls the
// backend server directly. After deploying the backend, put its URL below.
const BACKEND_URL = 'https://studymate-api-07yn.onrender.com';
const API_BASE = location.hostname.endsWith('.vercel.app') ? BACKEND_URL : '';

// Thin fetch wrapper: JSON API, errors carry status/code/data.
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(API_BASE + path, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (_) { data = null; }
  if (!res.ok) {
    const err = new Error((data && data.message) || ('Request failed (' + res.status + ')'));
    err.status = res.status;
    err.code = data && data.error;
    err.data = data;
    throw err;
  }
  return data;
}
