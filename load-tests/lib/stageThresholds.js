// Утилиты для порогов (thresholds) по ступеням RAMP_STAGES, а не только по
// всему прогону целиком. Обычные k6-thresholds считаются по всем запросам
// сразу — этого недостаточно, чтобы понять, на какой именно ступени RPS
// сервис перестал укладываться в пороги. Решение: тегировать каждый запрос
// текущей целевой ступенью (stage_rps) и объявить те же пороги ещё и для
// каждого значения тега — k6 посчитает их как независимые сабметрики
// (`http_req_duration{stage_rps:400}` и т.п.), и по ним потом в
// summarizeMaxRps() (lib/maxRpsSummary.js) можно определить максимальную
// ступень, где всё ещё выполнялись оба порога.

export const STAGE_TAG = 'stage_rps';

/**
 * Целевой RPS ступени, на которой сейчас выполняется итерация. Считается по
 * времени с начала прогона и длительностям ступеней — публичного API,
 * чтобы спросить у executor'а ramping-arrival-rate текущую ступень
 * напрямую, в k6 нет.
 */
export function currentStageTarget(rampStages, elapsedMs) {
    let boundary = 0;

    for (const stage of rampStages) {
        boundary += parseDurationMs(stage.duration);
        if (elapsedMs < boundary) {
            return stage.target;
        }
    }

    return rampStages[rampStages.length - 1].target;
}

export const stageTag = (target) => ({ [STAGE_TAG]: String(target) });

/**
 * Пороги из `rules` (например, { http_req_duration: ['p(95)<500'] })
 * применяются и ко всему прогону целиком, и отдельно к каждой ступени из
 * rampStages через сабметрику `{stage_rps:<target>}`.
 */
export function buildStageThresholds(rampStages, rules) {
    const thresholds = { ...rules };

    for (const stage of rampStages) {
        for (const [metric, metricRules] of Object.entries(rules)) {
            thresholds[`${metric}{${STAGE_TAG}:${stage.target}}`] = metricRules;
        }
    }

    return thresholds;
}

function parseDurationMs(duration) {
    const unitMs = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 };
    let total = 0;

    for (const [, amount, unit] of duration.matchAll(/(\d+)(ms|s|m|h)/g)) {
        total += Number(amount) * unitMs[unit];
    }

    return total;
}
