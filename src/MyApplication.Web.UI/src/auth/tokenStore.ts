// Access token живёт только в памяти модуля (не в localStorage/sessionStorage) —
// так он недоступен другому JS через постоянное хранилище и пропадает при
// перезагрузке страницы. Восстановление сессии после перезагрузки — через
// refresh (httpOnly cookie), см. AuthProvider.

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
