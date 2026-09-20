import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advanceTime as advance } from "../../test/advanceTime";
import { FakeNotesBackend } from "../../test/FakeNotesBackend";
import { renderWithProviders } from "../../test/renderWithProviders";
import { server } from "../../test/server";
import { NoteEditorPanel } from "./NoteEditorPanel";

// Заметка открыта в двух местах — docs/docs/notes/web-ui.md, раздел
// "Заметка изменена в другом месте". Sut — NoteEditorPanel целиком, как и в
// NoteEditorAutosave.test.tsx; правку "из другой вкладки" изображает
// FakeNotesBackend.editElsewhere, то есть тот же HTTP-бэкенд, а не мок хука.

const AUTOSAVE_DELAY_MS = 5000;

describe("Conflict with an edit made elsewhere", () => {
  let backend: FakeNotesBackend;

  beforeEach(() => {
    backend = new FakeNotesBackend();
    server.use(...backend.handlers);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime, delay: null });
  const textArea = () => screen.getAllByRole("textbox")[1] as HTMLTextAreaElement;
  const conflictWarning = () => screen.queryByText("Заметка изменена в другом месте");
  const reloadButton = () => screen.getByRole("button", { name: "Загрузить актуальную" });
  const overwriteButton = () => screen.getByRole("button", { name: "Перезаписать моей" });

  // Предупреждение должно оставаться на экране, пока пользователь листает длинную
  // заметку. Раскладки в jsdom нет, прокрутить нечего, поэтому проверяем причину:
  // предупреждение не лежит внутри прокручиваемой области.
  const scrollableAncestorOf = (element: HTMLElement) => {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const { overflow } = getComputedStyle(parent);
      if (overflow === "auto" || overflow === "scroll") {
        return parent;
      }
    }
    return null;
  };

  // Открывает заметку, правит её "из другой вкладки" и печатает свой вариант,
  // доводя редактор до отклонённого сохранения.
  async function openConflictedNote() {
    backend.addNote({ id: "a", title: "Заголовок", text: "исходный" });
    const user = setup();
    renderWithProviders(<NoteEditorPanel noteId="a" />);
    await advance(0);

    backend.editElsewhere("a", { text: "правка из другой вкладки" });

    await user.clear(textArea());
    await user.type(textArea(), "моя правка");
    await advance(AUTOSAVE_DELAY_MS);
    return user;
  }

  it("warns instead of overwriting when the note was changed elsewhere", async () => {
    // Arrange
    // Act
    await openConflictedNote();

    // Assert
    expect(conflictWarning()).toBeInTheDocument();
    expect(backend.updates).toHaveLength(1);
  });

  it("keeps what the user typed after the conflict", async () => {
    // Arrange
    // Act
    await openConflictedNote();

    // Assert
    expect(textArea()).toHaveValue("моя правка");
  });

  it("keeps the warning out of the scrolled part of the note", async () => {
    // Arrange
    await openConflictedNote();

    // Act
    const warning = screen.getByRole("alert");

    // Assert
    expect(scrollableAncestorOf(warning)).toBeNull();
  });

  it("stops autosaving while the conflict is unresolved", async () => {
    // Arrange
    const user = await openConflictedNote();

    // Act
    await user.type(textArea(), " ещё");
    await advance(AUTOSAVE_DELAY_MS * 3);

    // Assert
    expect(backend.updates).toHaveLength(1);
  });

  it("shows the note from the server and hides the warning after 'Загрузить актуальную'", async () => {
    // Arrange
    const user = await openConflictedNote();

    // Act
    await user.click(reloadButton());
    await advance(0);

    // Assert
    expect(textArea()).toHaveValue("правка из другой вкладки");
    expect(conflictWarning()).not.toBeInTheDocument();
  });

  it("autosaves again after 'Загрузить актуальную'", async () => {
    // Arrange
    const user = await openConflictedNote();
    await user.click(reloadButton());
    await advance(0);

    // Act
    await user.type(textArea(), " и моя");
    await advance(AUTOSAVE_DELAY_MS);

    // Assert
    expect(backend.updates.map((update) => update.request)).toEqual([
      { title: "Заголовок", text: "моя правка", version: 1 },
      { title: "Заголовок", text: "правка из другой вкладки и моя", version: 2 },
    ]);
  });

  it("saves the user's own version against the current one after 'Перезаписать моей'", async () => {
    // Arrange
    const user = await openConflictedNote();

    // Act
    await user.click(overwriteButton());
    await advance(0);

    // Assert
    expect(backend.updates.map((update) => update.request)).toEqual([
      { title: "Заголовок", text: "моя правка", version: 1 },
      { title: "Заголовок", text: "моя правка", version: 2 },
    ]);
    expect(conflictWarning()).not.toBeInTheDocument();
  });

  it("autosaves again after 'Перезаписать моей'", async () => {
    // Arrange
    const user = await openConflictedNote();
    await user.click(overwriteButton());
    await advance(0);

    // Act
    await user.type(textArea(), " ещё");
    await advance(AUTOSAVE_DELAY_MS);

    // Assert
    expect(backend.updates.map((update) => update.request.version)).toEqual([1, 2, 3]);
  });

  it("sends the version returned by the previous save in the next one", async () => {
    // Arrange
    backend.addNote({ id: "a", title: "Заголовок", text: "" });
    const user = setup();
    renderWithProviders(<NoteEditorPanel noteId="a" />);
    await advance(0);

    // Act
    await user.type(textArea(), "A");
    await advance(AUTOSAVE_DELAY_MS);
    await user.type(textArea(), "B");
    await advance(AUTOSAVE_DELAY_MS);

    // Assert
    expect(backend.updates.map((update) => update.request.version)).toEqual([1, 2]);
    expect(conflictWarning()).not.toBeInTheDocument();
  });
});
