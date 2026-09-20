export type SaveStatus = "idle" | "saving";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const timeFormatter = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

// Правила статуса сохранения (docs/docs/notes/web-ui.md, раздел "Сохранение заметок"):
// идёт запрос -> "Сохраняется…"; не более часа назад -> минуты; не более суток -> время; иначе -> дата.
export function formatSaveStatusText(status: SaveStatus, lastSavedAt: Date | null, now: Date): string {
  if (status === "saving") {
    return "Сохраняется…";
  }

  if (!lastSavedAt) {
    return "";
  }

  // now берётся из тикающего таймера (см. useNow) и обновляется раз в
  // STATUS_TICK_MS, поэтому сразу после сохранения может на мгновение отстать
  // от lastSavedAt — не даём разнице уйти в отрицательные значения.
  const elapsedMs = Math.max(0, now.getTime() - lastSavedAt.getTime());

  if (elapsedMs < HOUR_MS) {
    const minutes = Math.floor(elapsedMs / MINUTE_MS);
    return `Сохранение: ${minutes} минут назад`;
  }

  if (elapsedMs < DAY_MS) {
    return `Сохранение: ${timeFormatter.format(lastSavedAt)}`;
  }

  return `Сохранение: ${dateFormatter.format(lastSavedAt)}`;
}
