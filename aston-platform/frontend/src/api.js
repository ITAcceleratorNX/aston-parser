const BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:3001/api" : "/api");

function getToken() {
  return localStorage.getItem("aston_token");
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem("aston_token");
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function login(loginName, password) {
  const data = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ login: loginName, password }),
  });
  localStorage.setItem("aston_token", data.token);
  return data;
}

export function logout() {
  localStorage.removeItem("aston_token");
}

export function isAuthed() {
  return Boolean(getToken());
}

export function fetchMetrics(params) {
  return request(`/metrics?${new URLSearchParams(clean(params))}`);
}

export function fetchCompare(params) {
  return request(`/metrics/compare?${new URLSearchParams(clean(params))}`);
}

export function fetchOptions(params) {
  return request(`/metrics/options?${new URLSearchParams(clean(params))}`);
}

export function fetchAnalytics(params) {
  return request(`/analytics?${new URLSearchParams(clean(params))}`);
}

export function fetchPeriods() {
  return request("/metrics/periods");
}

function clean(params) {
  const out = {};
  for (const [key, value] of Object.entries(params || {})) {
    if (value != null && value !== "") out[key] = value;
  }
  return out;
}
