import http from 'k6/http';
import { check, fail } from 'k6';

// Фиктивный Google ID token: изолированный нагрузочный стенд
// (ci/docker-compose.load-tests-db.yml, ASPNETCORE_ENVIRONMENT=LoadTest)
// подменяет IGoogleIdTokenValidator двойником, который выводит профиль прямо
// из этой строки (см. MyApplication.Infrastructure.Auth.LoadTestGoogleIdTokenValidator) —
// один и тот же токен на весь прогон означает одного и того же пользователя,
// от имени которого идут все запросы сценария.
const LOAD_TEST_ID_TOKEN = 'k6-load-test';

/**
 * Логинится через настоящий POST /Auth/google (с фиктивным Google ID token,
 * см. LOAD_TEST_ID_TOKEN) и возвращает access token. Вызывается один раз в
 * setup() каждого сценария — все VU прогона используют один и тот же токен
 * (Jwt__AccessTokenLifetimeMinutes в изолированном стенде поднят с запасом,
 * чтобы токен не истёк за время прогона — refresh здесь не реализован).
 */
export function loginLoadTestUser(baseUrl) {
    const response = http.post(`${baseUrl}/Auth/google`, JSON.stringify({ idToken: LOAD_TEST_ID_TOKEN }), {
        headers: { 'Content-Type': 'application/json' },
    });

    const ok = check(response, { 'login: получен access token (200)': (r) => r.status === 200 });
    if (!ok) {
        fail(`Не удалось залогиниться для нагрузочного теста: HTTP ${response.status} ${response.body}`);
    }

    return JSON.parse(response.body).accessToken;
}

/** Заголовки с Authorization: Bearer для аутентифицированного запроса к /Notes. */
export function authHeaders(token, extraHeaders) {
    return { Authorization: `Bearer ${token}`, ...extraHeaders };
}
