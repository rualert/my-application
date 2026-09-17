import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, SEED_COUNT, RAMP_STAGES, MAX_VUS } from '../config.js';
import { seedNotes } from '../lib/seed.js';

// Сценарий «получить список заметок» (GET /Notes). Цель — найти
// максимальный RPS, который сервис держит с приемлемой латентностью и без
// ошибок: k6 ступенчато поднимает целевой RPS (см. RAMP_STAGES в config.js)
// и останавливается, если thresholds ниже нарушены — по логам/summary видно,
// на какой ступени это произошло.
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
    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<500'],
    },
};

export function setup() {
    seedNotes(BASE_URL, SEED_COUNT);
}

export default function () {
    const response = http.get(`${BASE_URL}/Notes`);
    check(response, { 'статус 200': (r) => r.status === 200 });
}
