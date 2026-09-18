import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';
import { BASE_URL, SEED_COUNT, RAMP_STAGES, MAX_VUS } from '../config.js';
import { seedNotes } from '../lib/seed.js';
import { loginLoadTestUser, authHeaders } from '../lib/auth.js';
import { buildStageThresholds, currentStageTarget, stageTag } from '../lib/stageThresholds.js';
import { summarizeMaxRps, readResultsHistory } from '../lib/maxRpsSummary.js';

// Сценарий «создать заметку» (POST /Notes). Цель — найти максимальный RPS,
// который сервис держит на запись, с приемлемой латентностью и без ошибок:
// k6 ступенчато поднимает целевой RPS (см. RAMP_STAGES в config.js). В
// отличие от GET-сценариев, здесь именно сама нагрузка пишет в базу —
// SEED_COUNT в setup() лишь создаёт реалистичный исходный объём данных
// (запись может замедляться с ростом таблицы/индексов), а не является
// предметом теста. Тегирование по ступеням и пороги — как в остальных
// сценариях (см. lib/stageThresholds.js, lib/maxRpsSummary.js).
const thresholdRules = {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(99)<500'],
};

const RESULTS_FILE = 'results/notes-create.md';
// Читаем на верхнем уровне (init-стадия) — см. комментарий к readResultsHistory().
const existingResultsHistory = readResultsHistory(`../${RESULTS_FILE}`);

export const options = {
    scenarios: {
        rps_ramp: {
            executor: 'ramping-arrival-rate',
            startRate: 10,
            timeUnit: '1s',
            preAllocatedVUs: 50,
            maxVUs: MAX_VUS,
            stages: RAMP_STAGES,
        },
    },
    thresholds: buildStageThresholds(RAMP_STAGES, thresholdRules),
    // Дефолтный setupTimeout (60s) может не хватить при большом SEED_COUNT,
    // даже с пакетным сидированием в lib/seed.js — запас на случай медленной
    // среды/очень большого SEED_COUNT.
    setupTimeout: '5m',
};

export function setup() {
    // /Notes защищён авторизацией и приватен по пользователю (см.
    // NotesController/NoteService) — логинимся один раз здесь, все VU
    // прогона шлют запросы от имени одного и того же load-test пользователя.
    const token = loginLoadTestUser(BASE_URL);
    seedNotes(BASE_URL, SEED_COUNT, token);
    return { token };
}

export default function (data) {
    const target = currentStageTarget(RAMP_STAGES, exec.instance.currentTestRunDuration);
    const response = http.post(
        `${BASE_URL}/Notes`,
        JSON.stringify({
            title: `Заметка для нагрузочного теста №${exec.scenario.iterationInTest}`,
            text: 'Текст, сгенерированный для нагрузочного тестирования.',
        }),
        { headers: authHeaders(data.token, { 'Content-Type': 'application/json' }), tags: stageTag(target) },
    );
    check(response, { 'статус 201': (r) => r.status === 201 });
}

export function handleSummary(data) {
    return summarizeMaxRps(data, RESULTS_FILE, existingResultsHistory, {
        thresholdRules,
        seedCount: SEED_COUNT,
    });
}
