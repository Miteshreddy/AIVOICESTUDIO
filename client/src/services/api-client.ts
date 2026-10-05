const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) ?? "http://localhost:8787";

const LONG_TIMEOUT_MS = 30 * 60_000;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Single-user local app: no auth headers needed.
async function authHeaders(): Promise<Headers> {
  return new Headers();
}

async function throwIfNotOk(response: Response, path: string) {
  if (!response.ok) {
    let details: unknown;
    try {
      details = await response.json();
    } catch {
      details = undefined;
    }
    const message =
      (details as { error?: string } | undefined)?.error ??
      `Request to ${path} failed with ${response.status}`;
    throw new ApiError(response.status, message, details);
  }
}

function withTimeoutError(err: unknown, path: string): never {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    throw new ApiError(
      408,
      `${path} timed out — the local engine may be starting up, overloaded, or not running.`,
    );
  }
  if (err instanceof TypeError) {
    throw new ApiError(0, `Couldn't reach the API server at ${API_BASE_URL} — is it running?`);
  }
  throw err;
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<T> {
  const headers = await authHeaders();
  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (init.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    withTimeoutError(err, path);
  }
  await throwIfNotOk(response, path);

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function requestBlob(path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<Blob> {
  const headers = await authHeaders();
  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    withTimeoutError(err, path);
  }
  await throwIfNotOk(response, path);
  return response.blob();
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  // Preset-voice previews are synthesised on first request.
  getBlob: (path: string) => requestBlob(path, { method: "GET" }, 180_000),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  // Local GPU work (cloning analysis, long narration, first-run model downloads)
  // can legitimately take many minutes — only give up after 30.
  postForm: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: "POST", body: formData }, LONG_TIMEOUT_MS),
  postBlob: (path: string, body?: unknown, formData?: FormData) =>
    requestBlob(
      path,
      { method: "POST", body: formData ?? (body ? JSON.stringify(body) : undefined) },
      LONG_TIMEOUT_MS,
    ),
  postFormBlob: (path: string, formData: FormData) =>
    requestBlob(path, { method: "POST", body: formData }, LONG_TIMEOUT_MS),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
