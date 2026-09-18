// Заметки в UI отдаются с того же origin, что и API — в проде через
// прокси в nginx.conf, в разработке через прокси dev-сервера (vite.config.ts).
// Поэтому здесь достаточно относительных путей, без базового URL и без CORS.

import { getAccessToken, setAccessToken } from "../auth/tokenStore";
import type { AuthResponse } from "./types";

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

let onSessionExpired: (() => void) | null = null;

// AuthProvider регистрирует колбэк, чтобы показать экран логина, когда ни
// access token, ни refresh-cookie больше не годятся.
export function setOnSessionExpired(callback: (() => void) | null): void {
  onSessionExpired = callback;
}

// Отдельный fetch в обход apiRequest — иначе 401 от самого /Auth/refresh
// рекурсивно запускал бы ту же логику повторного рефреша.
async function refreshAccessToken(): Promise<string | null> {
  const response = await fetch("/Auth/refresh", { method: "POST" });
  if (!response.ok) {
    return null;
  }

  const auth = (await response.json()) as AuthResponse;
  setAccessToken(auth.accessToken);
  return auth.accessToken;
}

function withAuthHeaders(init: RequestInit | undefined, accessToken: string | null): RequestInit {
  return {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  };
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response = await fetch(path, withAuthHeaders(init, getAccessToken()));

  // Эндпоинты /Auth/* не защищены Bearer-токеном — их 401 означает
  // невалидный логин/refresh, а не истёкший access token, повторять нечего.
  if (response.status === 401 && !path.startsWith("/Auth/")) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      response = await fetch(path, withAuthHeaders(init, refreshedToken));
    } else {
      setAccessToken(null);
      onSessionExpired?.();
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, await extractErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
