import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, SEED_COUNT, RAMP_STAGES, MAX_VUS } from '../config.js';
import { seedNotes } from '../lib/seed.js';

// Сценарий «получить заметку по идентификатору» (GET /Notes/{id}). Цель —
// найти максимальный RPS, который сервис держит с приемлемой латентностью и
// без ошибок: k6 ступенчато поднимает целевой RPS (см. RAMP_STAGES в
// config.js) и останавливается, если thresholds ниже нарушены — по
// логам/summary видно, на какой ступени это произошло.
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
    const ids = seedNotes(BASE_URL, SEED_COUNT);
    return { ids };
}

export default function (data) {
    const id = data.ids[Math.floor(Math.random() * data.ids.length)];
    const response = http.get(`${BASE_URL}/Notes/${id}`);
    check(response, { 'статус 200': (r) => r.status === 200 });
}
