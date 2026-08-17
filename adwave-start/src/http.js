export function joinUrl(base, path) {
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return new URL(String(path).replace(/^\/+/, ""), normalizedBase).toString();
}

export async function requestRaw(url, { method = "GET", headers = {}, body, timeout = 90000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { method, headers, body, signal: controller.signal });
    const text = await response.text();
    return { status: response.status, headers: response.headers, body: text };
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error(`TimeoutException on ${method} ${url}`);
      timeoutError.retryable = true;
      throw timeoutError;
    }
    const networkError = new Error(`${error.name || "NetworkError"} on ${method} ${url}`);
    networkError.retryable = true;
    throw networkError;
  } finally {
    clearTimeout(timer);
  }
}
