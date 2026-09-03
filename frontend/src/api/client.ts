const apiUrl = import.meta.env.VITE_API_URL ?? "";

export class ApiRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export const apiGet = async <T>(path: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(`${apiUrl}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ApiRequestError(response.status, body.error ?? `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
};

export const apiPost = async <T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ApiRequestError(response.status, errorBody.error ?? `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
};

