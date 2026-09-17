import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.4/index.js';
import { STAGE_TAG } from './stageThresholds.js';

/**
 * Читает уже накопленную историю прогонов из md-файла результатов.
 * **Обязательно вызывать на верхнем уровне сценария (init-стадия)** —
 * open() в k6 работает только до старта VU/итераций; вызов из handleSummary()
 * (тест уже закончился) падает с "open function is only available in the
 * init stage". Путь — относительно файла сценария (scenarios/*.js), а не
 * рабочей директории процесса, поэтому здесь ожидается '../results/....md'
 * (см. вызов в scenarios/notes-list.js и scenarios/notes-get-by-id.js).
 */
export function readResultsHistory(resultsFileFromScenario) {
    try {
        return open(resultsFileFromScenario);
    } catch (e) {
        return '';
    }
}

/**
 * handleSummary() для всех сценариев. Определив handleSummary(), k6
 * перестаёт сам печатать стандартную сводку — поэтому она воссоздаётся
 * через jslib (textSummary) и к ней добавляется одна строка: максимальный
 * RPS, на котором ещё выполнялись все пороги (см. buildStageThresholds() в
 * lib/stageThresholds.js — именно оттуда берутся сабметрики по ступеням).
 *
 * `resultsFile` — путь до md-файла с историей прогонов этого сценария,
 * относительно рабочей директории процесса k6 (load-tests/, см. -w в
 * scripts/Invoke-K6Scenario.ps1) — **не тот же путь**, что передаётся в
 * readResultsHistory() выше (там путь относительно файла сценария); это
 * реальная особенность k6, а не опечатка. `existingHistory` — то, что вернул
 * readResultsHistory(), считанное заранее на верхнем уровне сценария.
 *
 * `runInfo` — `{ thresholdRules, seedCount }` этого конкретного прогона
 * (объект thresholds сценария и SEED_COUNT из config.js) — записываются в
 * файл результатов вместе с датой и RPS, чтобы строка истории была
 * самодостаточной: без них цифра RPS бессмысленна вне контекста, при каких
 * порогах и объёме данных она получена (thresholds/SEED_COUNT можно менять
 * между прогонами).
 */
export function summarizeMaxRps(data, resultsFile, existingHistory, runInfo) {
    const maxRps = findMaxPassingStageRps(data);
    const maxRpsText = maxRps === null ? 'none (even the first stage failed)' : String(maxRps);
    const line = `Maximum RPS satisfying thresholds: ${maxRpsText}`;

    const output = {
        stdout: `${textSummary(data, { indent: ' ', enableColors: false })}\n${line}\n`,
    };

    if (resultsFile) {
        const date = new Date().toISOString().slice(0, 10);
        const thresholdsText = formatThresholds(runInfo.thresholdRules);
        const row = `| ${date} | ${maxRpsText} | ${thresholdsText} | ${runInfo.seedCount} |\n`;
        output[resultsFile] = `${existingHistory}${row}`;
    }

    return output;
}

function formatThresholds(thresholdRules) {
    return Object.entries(thresholdRules)
        .map(([metric, rules]) => `${metric}: ${rules.join(', ')}`)
        .join('; ');
}

function findMaxPassingStageRps(data) {
    const stageTagPattern = new RegExp(`${STAGE_TAG}:(\\d+)`);
    const stagePassed = new Map();

    for (const [metricName, metric] of Object.entries(data.metrics)) {
        if (!metric.thresholds) continue;

        const match = metricName.match(stageTagPattern);
        if (!match) continue;

        const stageRps = Number(match[1]);
        const metricPassed = Object.values(metric.thresholds).every((t) => t.ok);
        const passedSoFar = stagePassed.get(stageRps) ?? true;
        stagePassed.set(stageRps, passedSoFar && metricPassed);
    }

    const passingStages = [...stagePassed.entries()]
        .filter(([, passed]) => passed)
        .map(([stageRps]) => stageRps);

    return passingStages.length > 0 ? Math.max(...passingStages) : null;
}
