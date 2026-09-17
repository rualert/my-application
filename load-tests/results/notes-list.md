# notes-list — результаты нагрузочных прогонов

Каждая строка дописывается автоматически после прогона `scenarios/notes-list.js`
(см. `lib/maxRpsSummary.js`).

| Дата | Max RPS | Thresholds | Seed count |
|---|---|---|---|
| 2026-09-17 | 200 | http_req_failed: rate<0.01; http_req_duration: p(99)<500 | 50 |
