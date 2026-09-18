// Заметки в UI отдаются с того же origin, что и API — в проде через
// прокси в nginx.conf, в разработке через прокси dev-сервера (vite.config.ts).
// Поэтому здесь достаточно относительных путей, без базового URL и без CORS.

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function extractErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  if (contentType.includes("json")) {
    try {
      const problem = JSON.parse(body) as { detail?: string; title?: string };
      return problem.detail ?? problem.title ?? body;
    } catch {
      return body;
    }
  }

  return body || response.statusText;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, await extractErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
