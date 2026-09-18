import http from 'k6/http';
import { check, fail } from 'k6';
import { authHeaders } from './auth.js';

const BATCH_SIZE = 50;

/**
 * Создаёт `count` заметок через реальный публичный API (POST /Notes) и
 * возвращает их идентификаторы. Используется в setup() сценариев, чтобы
 * тест работал с реалистичным объёмом данных, а не с пустой базой.
 *
 * Отправляет запросы пачками по BATCH_SIZE через http.batch() (параллельно
 * внутри пачки), а не по одному — иначе при большом SEED_COUNT (тысячи
 * заметок) setup() не укладывается в дефолтный k6 setupTimeout (60s, см.
 * options.setupTimeout в сценариях) и весь прогон падает с "setup()
 * execution timed out", даже не начав генерировать нагрузку — снаружи это
 * выглядит так, будто SEED_COUNT «не применился».
 *
 * /Notes защищён авторизацией (см. lib/auth.js) — `token` должен быть
 * access token, полученный через loginLoadTestUser() в том же setup().
 */
export function seedNotes(baseUrl, count, token) {
    const ids = [];

    for (let start = 0; start < count; start += BATCH_SIZE) {
        const batchSize = Math.min(BATCH_SIZE, count - start);
        const requests = Array.from({ length: batchSize }, (_, i) => ({
            method: 'POST',
            url: `${baseUrl}/Notes`,
            body: JSON.stringify({
                title: `Заметка для нагрузочного теста №${start + i}`,
                text: 'Текст, сгенерированный для нагрузочного тестирования.',
            }),
            params: { headers: authHeaders(token, { 'Content-Type': 'application/json' }) },
        }));

        for (const [i, response] of http.batch(requests).entries()) {
            const created = check(response, {
                'seed: заметка создана (201)': (r) => r.status === 201,
            });

            if (!created) {
                fail(`Не удалось засеять заметку #${start + i}: HTTP ${response.status} ${response.body}`);
            }

            ids.push(JSON.parse(response.body).id);
        }
    }

    return ids;
}
