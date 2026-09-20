import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAccessToken, setAccessToken } from "../auth/tokenStore";
import { server } from "../test/server";
import { ApiError, apiRequest, setOnSessionExpired } from "./client";

// Поведение сессии описано в docs/docs/auth/ и в CLAUDE.md (раздел Web.UI, `auth/`).
// Тест-объект (Sut) — apiRequest: настоящий fetch-клиент и tokenStore, HTTP подменён MSW.
describe("apiRequest", () => {
  afterEach(() => {
    setOnSessionExpired(null);
  });

  it("sends the current access token as a Bearer header", async () => {
    // Arrange
    setAccessToken("token-1");
    let authorization: string | null = null;
    server.use(
      http.get("/Notes/a", ({ request }) => {
        authorization = request.headers.get("Authorization");
        return HttpResponse.json({ id: "a" });
      }),
    );

    // Act
    const note = await apiRequest<{ id: string }>("/Notes/a");

    // Assert
    expect(authorization).toBe("Bearer token-1");
    expect(note).toEqual({ id: "a" });
  });

  it("refreshes the token on 401 and retries the request once with the new token", async () => {
    // Arrange
    setAccessToken("expired");
    const seenTokens: Array<string | null> = [];
    server.use(
      http.get("/Notes/a", ({ request }) => {
        const authorization = request.headers.get("Authorization");
        seenTokens.push(authorization);
        return authorization === "Bearer fresh"
          ? HttpResponse.json({ id: "a" })
          : new HttpResponse(null, { status: 401 });
      }),
      http.post("/Auth/refresh", () =>
        HttpResponse.json({ accessToken: "fresh", expiresAt: "2026-01-01T00:00:00Z", userName: "Иван" }),
      ),
    );

    // Act
    const note = await apiRequest<{ id: string }>("/Notes/a");

    // Assert
    expect(note).toEqual({ id: "a" });
    expect(seenTokens).toEqual(["Bearer expired", "Bearer fresh"]);
    expect(getAccessToken()).toBe("fresh");
  });

  it("ends the session when the refresh fails after a 401", async () => {
    // Arrange
    setAccessToken("expired");
    const onSessionExpired = vi.fn();
    setOnSessionExpired(onSessionExpired);
    server.use(
      http.get("/Notes/a", () => new HttpResponse(null, { status: 401 })),
      http.post("/Auth/refresh", () => new HttpResponse(null, { status: 401 })),
    );

    // Act
    const request = apiRequest("/Notes/a");

    // Assert
    await expect(request).rejects.toMatchObject({ name: "ApiError", status: 401 });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });

  it("does not try to refresh when an /Auth/* endpoint itself answers 401", async () => {
    // Arrange
    let refreshCalls = 0;
    server.use(
      http.post("/Auth/google", () => new HttpResponse("Недействительный токен Google", { status: 401 })),
      http.post("/Auth/refresh", () => {
        refreshCalls += 1;
        return new HttpResponse(null, { status: 401 });
      }),
    );

    // Act
    const request = apiRequest("/Auth/google", { method: "POST" });

    // Assert
    await expect(request).rejects.toMatchObject({ status: 401, message: "Недействительный токен Google" });
    expect(refreshCalls).toBe(0);
  });

  it("returns undefined for a 204 response", async () => {
    // Arrange
    server.use(http.delete("/Notes/a", () => new HttpResponse(null, { status: 204 })));

    // Act
    const result = await apiRequest<void>("/Notes/a", { method: "DELETE" });

    // Assert
    expect(result).toBeUndefined();
  });

  it("throws ApiError with the plain-text body as the message", async () => {
    // Arrange
    server.use(http.get("/Notes/a", () => new HttpResponse("Заметка не найдена", { status: 400 })));

    // Act
    const request = apiRequest("/Notes/a");

    // Assert
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ status: 400, message: "Заметка не найдена" });
  });

  it("uses `detail` from a JSON problem response as the message", async () => {
    // Arrange
    server.use(
      http.get("/Notes/a", () =>
        HttpResponse.json({ title: "Ошибка", detail: "Подробности ошибки" }, { status: 500 }),
      ),
    );

    // Act
    const request = apiRequest("/Notes/a");

    // Assert
    await expect(request).rejects.toMatchObject({ status: 500, message: "Подробности ошибки" });
  });

  it("falls back to `title` when a JSON problem response has no `detail`", async () => {
    // Arrange
    server.use(http.get("/Notes/a", () => HttpResponse.json({ title: "Внутренняя ошибка" }, { status: 500 })));

    // Act
    const request = apiRequest("/Notes/a");

    // Assert
    await expect(request).rejects.toMatchObject({ status: 500, message: "Внутренняя ошибка" });
  });
});
