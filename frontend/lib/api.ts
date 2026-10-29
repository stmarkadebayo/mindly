// Server calls. Errors carry an HTTP status, or `offline: true` when the network is unreachable.

export class ApiError extends Error {
  constructor(message: string, public status = 0, public offline = false) {
    super(message);
  }
}

/** `quiet` skips the app-wide "you were signed out" reaction. The startup session check uses it, since being signed out is normal there. */
type Options = { method?: string; json?: unknown; form?: FormData; quiet?: boolean };

export async function api<T = any>(path: string, { method = "GET", json, form, quiet = false }: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: json !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: json !== undefined ? JSON.stringify(json) : form,
    });
  } catch {
    throw new ApiError("You're offline.", 0, true);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !quiet && !path.startsWith("/api/auth")) window.dispatchEvent(new Event("mindly:signed-out"));
    throw new ApiError(data.detail || "Something went wrong.", res.status);
  }
  return data as T;
}
