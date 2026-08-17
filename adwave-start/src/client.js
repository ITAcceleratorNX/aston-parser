import { AuthError, refreshTokens } from "./auth.js";
import { joinUrl, requestRaw } from "./http.js";
import { logger } from "./logging.js";

const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export class AdwaveApiError extends Error {
  constructor(message, { statusCode = null, retryable = false } = {}) {
    super(message);
    this.name = "AdwaveApiError";
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AdwaveClient {
  constructor(settings, store) {
    this.settings = settings;
    this.store = store;
  }

  async request(method, path, { params, jsonBody, allowRefresh = true } = {}) {
    const attempts = Math.max(1, this.settings.maxRetries);
    let lastError = null;
    let refreshed = false;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const headers = { Accept: "application/json" };
      if (this.store.accessToken) headers.Authorization = `Bearer ${this.store.accessToken}`;
      if (jsonBody !== undefined) headers["Content-Type"] = "application/json";

      const url = new URL(joinUrl(this.settings.baseUrl, path));
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          if (value != null) url.searchParams.set(key, String(value));
        }
      }

      let response;
      try {
        response = await requestRaw(url.toString(), {
          method,
          headers,
          body: jsonBody === undefined ? undefined : JSON.stringify(jsonBody),
          timeout: this.settings.requestTimeout,
        });
      } catch (error) {
        lastError = new AdwaveApiError(error.message, { retryable: true });
        logger.warn(`Transport error on ${method} ${path} (attempt ${attempt}/${attempts})`);
        await sleep(Math.min(30000, 1.5 ** attempt * 1000));
        continue;
      }

      if (response.status === 401 && allowRefresh && this.store.hasRefresh() && !refreshed) {
        logger.info("Received 401, attempting refresh token");
        try {
          await refreshTokens(this.settings, this.store);
          refreshed = true;
          continue;
        } catch (error) {
          if (error instanceof AuthError) {
            throw new AdwaveApiError(error.message, { statusCode: 401, retryable: false });
          }
          throw error;
        }
      }

      if (RETRY_STATUSES.has(response.status)) {
        lastError = new AdwaveApiError(`HTTP ${response.status} on ${method} ${path}`, {
          statusCode: response.status,
          retryable: true,
        });
        logger.warn(`Retryable HTTP ${response.status} on ${method} ${path} (attempt ${attempt}/${attempts})`);
        const retryAfter = Number(response.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : Math.min(30000, 1.5 ** attempt * 1000));
        continue;
      }

      if (response.status >= 400) {
        throw new AdwaveApiError(errorMessage(response, method, path), {
          statusCode: response.status,
          retryable: false,
        });
      }

      return parseBody(response, method, path);
    }

    throw lastError;
  }

  get(path, params) {
    return this.request("GET", path, { params });
  }

  post(path, jsonBody = {}, params) {
    return this.request("POST", path, { params, jsonBody });
  }
}

function parseBody(response, method, path) {
  if (!response.body) return null;
  try {
    return JSON.parse(response.body);
  } catch {
    throw new AdwaveApiError(`Non-JSON response on ${method} ${path}`, {
      statusCode: response.status,
      retryable: true,
    });
  }
}

function errorMessage(response, method, path) {
  let status = response.status;
  let message = "";
  try {
    const payload = JSON.parse(response.body || "{}");
    message = payload.message || "";
    status = payload.statusCode || status;
  } catch {
    message = "";
  }
  return message ? `HTTP ${status} on ${method} ${path}: ${message}` : `HTTP ${status} on ${method} ${path}`;
}
