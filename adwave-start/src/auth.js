import { existsSync, readFileSync } from "node:fs";
import { atomicWrite, upsertEnvValue } from "./fsutil.js";
import { joinUrl, requestRaw } from "./http.js";

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthError";
  }
}

const TOKEN_KEYS = ["accessToken", "token", "access_token"];
const REFRESH_KEYS = ["refreshToken", "refresh_token"];

export function decodeJwtClaims(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return {};
  try {
    const padded = parts[1] + "=".repeat((4 - (parts[1].length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

export function tokenExpiryIso(token) {
  const exp = decodeJwtClaims(token).exp;
  if (typeof exp !== "number") return null;
  return new Date(exp * 1000).toISOString();
}

export function secondsUntilExpiry(token) {
  const exp = decodeJwtClaims(token).exp;
  if (typeof exp !== "number") return null;
  return exp - Date.now() / 1000;
}

function firstKey(keys, sources) {
  for (const key of keys) {
    for (const source of sources) {
      if (source?.[key]) return String(source[key]);
    }
  }
  return "";
}

export function extractTokens(payload = {}) {
  const sources = [payload];
  if (payload.data && typeof payload.data === "object") sources.push(payload.data);
  return {
    access: firstKey(TOKEN_KEYS, sources),
    refresh: firstKey(REFRESH_KEYS, sources),
  };
}

export class TokenStore {
  constructor(settings) {
    this.settings = settings;
    this.accessToken = settings.accessToken || "";
    this.refreshToken = settings.refreshToken || "";
    this.loadFile();
  }

  loadFile() {
    if (!existsSync(this.settings.tokenFile)) return;
    try {
      const data = JSON.parse(readFileSync(this.settings.tokenFile, "utf8"));
      this.accessToken = this.accessToken || String(data.access_token || "");
      this.refreshToken = this.refreshToken || String(data.refresh_token || "");
    } catch {
      // ignore unreadable token file
    }
  }

  hasAccess() {
    return Boolean(this.accessToken);
  }

  hasRefresh() {
    return Boolean(this.refreshToken);
  }

  update(accessToken, refreshToken) {
    if (accessToken) this.accessToken = accessToken;
    if (refreshToken) this.refreshToken = refreshToken;
    this.save();
  }

  save() {
    const payload = {
      access_token: this.accessToken,
      refresh_token: this.refreshToken,
      updated_at: new Date().toISOString(),
    };
    const expiry = this.accessToken ? tokenExpiryIso(this.accessToken) : null;
    if (expiry) payload.access_expires_at = expiry;
    atomicWrite(this.settings.tokenFile, `${JSON.stringify(payload, null, 2)}\n`);
    this.syncEnvFile();
  }

  syncEnvFile() {
    if (!existsSync(this.settings.envFile)) return;
    const text = readFileSync(this.settings.envFile, "utf8");
    let updated = upsertEnvValue(text, "ADWAVE_ACCESS_TOKEN", this.accessToken);
    updated = upsertEnvValue(updated, "ADWAVE_REFRESH_TOKEN", this.refreshToken);
    if (updated !== text) atomicWrite(this.settings.envFile, updated);
  }

  accessStatus() {
    const ttl = this.accessToken ? secondsUntilExpiry(this.accessToken) : null;
    return {
      has_access_token: Boolean(this.accessToken),
      has_refresh_token: Boolean(this.refreshToken),
      access_expires_at: this.accessToken ? tokenExpiryIso(this.accessToken) : null,
      access_ttl_seconds: ttl == null ? null : Math.round(ttl),
      access_expired: Boolean(ttl != null && ttl <= 0),
    };
  }
}

async function postJson(settings, path, body) {
  const url = joinUrl(settings.baseUrl, path);
  const response = await requestRaw(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    timeout: settings.requestTimeout,
  });
  let payload = {};
  try {
    payload = response.body ? JSON.parse(response.body) : {};
  } catch {
    payload = {};
  }
  return { status: response.status, payload };
}

function safeError(fallback, status, payload) {
  const message = payload?.message ? `: ${payload.message}` : "";
  const path = payload?.path ? ` path=${payload.path}` : "";
  return `${fallback} HTTP ${payload?.statusCode || status}${path}${message}`;
}

export async function sendLoginCode(settings, phone) {
  if (!phone) throw new AuthError("Phone number is required for login.");
  const { status, payload } = await postJson(settings, "auth/send-code", { phoneNumber: phone });
  if (status >= 400) throw new AuthError(safeError("Failed to send login code.", status, payload));
}

export async function verifyLoginCode(settings, phone, code, store) {
  if (!phone || !code) throw new AuthError("Phone and OTP code are required.");
  const { status, payload } = await postJson(settings, "auth/verify-code", { phoneNumber: phone, code });
  if (status >= 400) throw new AuthError(safeError("OTP verification failed.", status, payload));
  const tokens = extractTokens(payload);
  if (!tokens.access || !tokens.refresh) {
    throw new AuthError("Login succeeded but tokens were missing in the response.");
  }
  store.update(tokens.access, tokens.refresh);
  return store.accessStatus();
}

export async function refreshTokens(settings, store) {
  if (!store.refreshToken) throw new AuthError("Refresh token is missing. Run login first.");
  const { status, payload } = await postJson(settings, "auth/refresh", { refreshToken: store.refreshToken });
  if (status >= 400) throw new AuthError(safeError("Refresh token failed.", status, payload));
  const tokens = extractTokens(payload);
  if (!tokens.access) throw new AuthError("Refresh response did not contain an access token.");
  store.update(tokens.access, tokens.refresh || undefined);
  return {
    ok: true,
    refresh_token_rotated: Boolean(tokens.refresh),
    ...store.accessStatus(),
  };
}
