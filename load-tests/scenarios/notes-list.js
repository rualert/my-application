import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';
import { BASE_URL, SEED_COUNT, RAMP_STAGES, MAX_VUS } from '../config.js';
import { seedNotes } from '../lib/seed.js';
import { loginLoadTestUser, authHeaders } from '../lib/auth.js';
import { buildStageThresholds, currentStageTarget, stageTag } from '../lib/stageThresholds.js';
import { summarizeMaxRps, readResultsHistory } from '../lib/maxRpsSummary.js';

// Сценарий «получить список заметок» (GET /Notes). Цель — найти
// максимальный RPS, который сервис держит с приемлемой латентностью и без
// ошибок: k6 ступенчато поднимает целевой RPS (см. RAMP_STAGES в config.js).
// Каждый запрос тегируется текущей ступенью (stage_rps), а пороги ниже
// объявлены и для всего прогона, и отдельно для каждой ступени — это
// позволяет handleSummary() напечатать ступень, на которой сервис впервые
// перестал укладываться в пороги (см. lib/stageThresholds.js, lib/maxRpsSummary.js).
const thresholdRules = {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(99)<500'],
};

const RESULTS_FILE = 'results/notes-list.md';
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
    const response = http.get(`${BASE_URL}/Notes`, { headers: authHeaders(data.token), tags: stageTag(target) });
    check(response, { 'статус 200': (r) => r.status === 200 });
}

export function handleSummary(data) {
    return summarizeMaxRps(data, RESULTS_FILE, existingResultsHistory, {
        thresholdRules,
        seedCount: SEED_COUNT,
    });
}
