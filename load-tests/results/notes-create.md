# notes-create — результаты нагрузочных прогонов

Каждая строка дописывается автоматически после прогона `scenarios/notes-create.js`
(см. `lib/maxRpsSummary.js`).

| Дата       | Max RPS | Thresholds                                               | Seed count |
|------------|---------|----------------------------------------------------------|------------|
| 2026-09-17 | 400     | http_req_failed: rate<0.01; http_req_duration: p(99)<500 | 50         |
| 2026-09-18 | 800     | http_req_failed: rate<0.01; http_req_duration: p(99)<500 | 50         |
