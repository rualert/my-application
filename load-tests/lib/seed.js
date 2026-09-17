import http from 'k6/http';
import { check, fail } from 'k6';

/**
 * Создаёт `count` заметок через реальный публичный API (POST /Notes) и
 * возвращает их идентификаторы. Используется в setup() сценариев, чтобы
 * тест работал с реалистичным объёмом данных, а не с пустой базой.
 */
export function seedNotes(baseUrl, count) {
    const ids = [];

    for (let i = 0; i < count; i++) {
        const response = http.post(
            `${baseUrl}/Notes`,
            JSON.stringify({
                title: `Заметка для нагрузочного теста №${i}`,
                text: 'Текст, сгенерированный для нагрузочного тестирования.',
            }),
            { headers: { 'Content-Type': 'application/json' } },
        );

        const created = check(response, {
            'seed: заметка создана (201)': (r) => r.status === 201,
        });

        if (!created) {
            fail(`Не удалось засеять заметку #${i}: HTTP ${response.status} ${response.body}`);
        }

        ids.push(JSON.parse(response.body).id);
    }

    return ids;
}
