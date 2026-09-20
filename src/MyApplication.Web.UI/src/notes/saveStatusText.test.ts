import { describe, expect, it } from "vitest";
import { formatSaveStatusText } from "./saveStatusText";

// Правила из docs/docs/notes/web-ui.md, раздел "Сохранение заметок".
describe("formatSaveStatusText", () => {
  const savedAt = new Date(2026, 0, 15, 9, 5, 0);
  const minutesLater = (minutes: number) => new Date(savedAt.getTime() + minutes * 60_000);

  it("shows 'Сохраняется…' while a save request is in flight", () => {
    // Arrange
    const now = minutesLater(10);

    // Act
    const text = formatSaveStatusText("saving", savedAt, now);

    // Assert
    expect(text).toBe("Сохраняется…");
  });

  it("is empty when nothing has been saved yet", () => {
    // Arrange
    const now = new Date(2026, 0, 15, 9, 5, 0);

    // Act
    const text = formatSaveStatusText("idle", null, now);

    // Assert
    expect(text).toBe("");
  });

  it.each([
    [0, "Сохранение: 0 минут назад"],
    [1, "Сохранение: 1 минут назад"],
    [59, "Сохранение: 59 минут назад"],
  ])("shows minutes when saved %i minutes ago (up to an hour)", (minutes, expected) => {
    // Arrange
    const now = minutesLater(minutes);

    // Act
    const text = formatSaveStatusText("idle", savedAt, now);

    // Assert
    expect(text).toBe(expected);
  });

  it("shows the time of day when saved more than an hour but less than a day ago", () => {
    // Arrange
    const now = minutesLater(60);

    // Act
    const text = formatSaveStatusText("idle", savedAt, now);

    // Assert
    expect(text).toBe("Сохранение: 09:05");
  });

  it("shows the date when saved a day ago or earlier", () => {
    // Arrange
    const now = minutesLater(24 * 60);

    // Act
    const text = formatSaveStatusText("idle", savedAt, now);

    // Assert
    expect(text).toBe("Сохранение: 15.01.2026");
  });

  // Реальный баг, пойманный руками: now тикает раз в 30с и сразу после
  // сохранения может отставать от lastSavedAt, давая "-1 минут назад".
  it("never shows negative minutes when the clock tick is behind the save time", () => {
    // Arrange
    const now = new Date(savedAt.getTime() - 5_000);

    // Act
    const text = formatSaveStatusText("idle", savedAt, now);

    // Assert
    expect(text).toBe("Сохранение: 0 минут назад");
  });
});
