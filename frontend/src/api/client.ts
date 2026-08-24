const apiUrl = import.meta.env.VITE_API_URL ?? "";

export class ApiRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
  }
}

const apiRequest = async <T>(
  path: string,
  init: RequestInit,
): Promise<T> => {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { Accept: "application/json" },
    ...init,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ApiRequestError(response.status, body.error ?? `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
};

export const apiGet = <T>(path: string, signal?: AbortSignal): Promise<T> =>
  apiRequest(path, { method: "GET", signal });

export const apiPost = <T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> => apiRequest(path, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify(body),
  signal,
});
