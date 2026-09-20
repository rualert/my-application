import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advanceTime as advance } from "../../test/advanceTime";
import { FakeNotesBackend } from "../../test/FakeNotesBackend";
import { renderWithProviders } from "../../test/renderWithProviders";
import { server } from "../../test/server";
import { NoteEditorPanel } from "./NoteEditorPanel";

// Правила автосохранения — docs/docs/notes/web-ui.md, раздел "Сохранение заметок".
// Тест-объект (Sut) — NoteEditorPanel целиком: настоящие хуки, TanStack Query и
// fetch-клиент; подменён только HTTP (FakeNotesBackend поверх MSW). Время —
// vi fake timers, чтобы 5 секунд ожидания не были настоящими.

const AUTOSAVE_DELAY_MS = 5000;

describe("Autosave in the note editor", () => {
  let backend: FakeNotesBackend;

  beforeEach(() => {
    backend = new FakeNotesBackend();
    server.use(...backend.handlers);
    // setImmediate/nextTick остаются настоящими: на них держится ответ MSW.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    Reflect.deleteProperty(document, "visibilityState");
    vi.useRealTimers();
  });

  async function openNote(noteId: string) {
    const view = renderWithProviders(<NoteEditorPanel noteId={noteId} />);
    await advance(0);
    return {
      ...view,
      open: async (nextNoteId: string) => {
        view.rerender(<NoteEditorPanel noteId={nextNoteId} />);
        await advance(0);
      },
    };
  }

  const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime, delay: null });
  const titleInput = () => screen.getAllByRole("textbox")[0] as HTMLInputElement;
  const textArea = () => screen.getAllByRole("textbox")[1] as HTMLTextAreaElement;

  it("saves 5 seconds after the first unsaved change, not earlier", async () => {
    // Arrange
    backend.addNote({ id: "a", title: "Заголовок", text: "" });
    const user = setup();
    await openNote("a");

    // Act
    await user.type(textArea(), "abc");
    await advance(AUTOSAVE_DELAY_MS - 1);
    const requestsBeforeDelay = backend.updates.length;
    await advance(1);

    // Assert
    expect(requestsBeforeDelay).toBe(0);
    expect(backend.updates).toEqual([{ id: "a", request: { title: "Заголовок", text: "abc", version: 1 } }]);
  });

  it("does not move the timer when the user keeps typing", async () => {
    // Arrange
    backend.addNote({ id: "a", title: "Заголовок", text: "" });
    const user = setup();
    await openNote("a");

    // Act
    await user.type(textArea(), "a");
    await advance(3000);
    await user.keyboard("b");
    await advance(2000);

    // Assert
    expect(backend.updates).toEqual([{ id: "a", request: { title: "Заголовок", text: "ab", version: 1 } }]);
  });

  it("keeps saving about every 5 seconds during continuous typing", async () => {
    // Arrange
    backend.addNote({ id: "a", title: "Заголовок", text: "" });
    const user = setup();
    await openNote("a");

    // Act
    await user.click(textArea());
    for (let second = 0; second < 10; second++) {
      await user.keyboard("x");
      await advance(1000);
    }

    // Assert
    expect(backend.updates.map((update) => update.request.text.length)).toEqual([5, 10]);
  });

  it("saves immediately when focus moves from the title to the text", async () => {
    // Arrange
    backend.addNote({ id: "a", title: null, text: "" });
    const user = setup();
    await openNote("a");
    await user.type(titleInput(), "Новый");

    // Act
    await user.click(textArea());
    await advance(0);

    // Assert
    expect(backend.updates).toEqual([{ id: "a", request: { title: "Новый", text: "", version: 1 } }]);
  });

  it("saves immediately when focus moves from the text to the title", async () => {
    // Arrange
    backend.addNote({ id: "a", title: "Заголовок", text: "" });
    const user = setup();
    await openNote("a");
    await user.type(textArea(), "abc");

    // Act
    await user.click(titleInput());
    await advance(0);

    // Assert
    expect(backend.updates).toEqual([{ id: "a", request: { title: "Заголовок", text: "abc", version: 1 } }]);
  });

  it("sends no request when focus changes but nothing was edited", async () => {
    // Arrange
    backend.addNote({ id: "a", title: "Заголовок", text: "текст" });
    const user = setup();
    await openNote("a");

    // Act
    await user.click(titleInput());
    await user.click(textArea());
    await user.click(document.body);
    await advance(AUTOSAVE_DELAY_MS * 2);

    // Assert
    expect(backend.updates).toEqual([]);
  });

  it("sends no request when an edit was undone before saving", async () => {
    // Arrange
    backend.addNote({ id: "a", title: "Заголовок", text: "" });
    const user = setup();
    await openNote("a");

    // Act
    await user.type(textArea(), "a");
    await user.keyboard("{Backspace}");
    await advance(AUTOSAVE_DELAY_MS);

    // Assert
    expect(backend.updates).toEqual([]);
  });

  it("saves the previous note when the user switches to another note", async () => {
    // Arrange
    backend.addNote({ id: "a", title: "Первая", text: "" });
    backend.addNote({ id: "b", title: "Вторая", text: "" });
    const user = setup();
    const sut = await openNote("a");
    await user.type(textArea(), "правка");

    // Act
    await sut.open("b");

    // Assert
    expect(backend.updates).toEqual([{ id: "a", request: { title: "Первая", text: "правка", version: 1 } }]);
  });

  it("does not save the new note after switching, when nothing was edited in it", async () => {
    // Arrange
    backend.addNote({ id: "a", title: "Первая", text: "" });
    backend.addNote({ id: "b", title: "Вторая", text: "" });
    const user = setup();
    const sut = await openNote("a");
    await user.type(textArea(), "правка");
    await sut.open("b");

    // Act
    await advance(AUTOSAVE_DELAY_MS * 2);

    // Assert
    expect(backend.updates.map((update) => update.id)).toEqual(["a"]);
  });

  it("saves immediately when the browser tab becomes hidden", async () => {
    // Arrange
    backend.addNote({ id: "a", title: "Заголовок", text: "" });
    const user = setup();
    await openNote("a");
    await user.type(textArea(), "abc");

    // Act
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    await advance(0);

    // Assert
    expect(backend.updates).toEqual([{ id: "a", request: { title: "Заголовок", text: "abc", version: 1 } }]);
  });

  it("does not overwrite what the user typed while a save request is in flight", async () => {
    // Arrange
    backend.addNote({ id: "a", title: "Заголовок", text: "" });
    const release = backend.holdUpdates();
    const user = setup();
    await openNote("a");
    await user.type(textArea(), "A");
    await advance(AUTOSAVE_DELAY_MS);

    // Act
    await user.keyboard("B");
    release();
    await advance(0);

    // Assert
    expect(backend.updates).toHaveLength(1);
    expect(textArea()).toHaveValue("AB");
  });

  it("saves what was typed during an in-flight request in the next save", async () => {
    // Arrange
    backend.addNote({ id: "a", title: "Заголовок", text: "" });
    const release = backend.holdUpdates();
    const user = setup();
    await openNote("a");
    await user.type(textArea(), "A");
    await advance(AUTOSAVE_DELAY_MS);
    await user.keyboard("B");
    release();
    await advance(0);

    // Act
    await advance(AUTOSAVE_DELAY_MS);

    // Assert
    expect(backend.updates.map((update) => update.request.text)).toEqual(["A", "AB"]);
  });

  it("sends only one request at a time and defers the next until the response", async () => {
    // Arrange
    backend.addNote({ id: "a", title: "Заголовок", text: "" });
    const release = backend.holdUpdates();
    const user = setup();
    await openNote("a");
    await user.type(textArea(), "A");
    await advance(AUTOSAVE_DELAY_MS);
    await user.keyboard("B");

    // Act
    await user.click(titleInput());
    await advance(0);
    const requestsWhileInFlight = backend.updates.length;
    release();
    await advance(0);

    // Assert
    expect(requestsWhileInFlight).toBe(1);
    expect(backend.updates.map((update) => update.request.text)).toEqual(["A", "AB"]);
  });

  it("sends an empty title as null", async () => {
    // Arrange
    backend.addNote({ id: "a", title: null, text: "" });
    const user = setup();
    await openNote("a");

    // Act
    await user.type(textArea(), "x");
    await advance(AUTOSAVE_DELAY_MS);

    // Assert
    expect(backend.updates).toEqual([{ id: "a", request: { title: null, text: "x", version: 1 } }]);
  });

  it("shows 'Сохраняется…' while the request is in flight and the save time after it", async () => {
    // Arrange
    backend.addNote({ id: "a", title: "Заголовок", text: "" });
    const release = backend.holdUpdates();
    const user = setup();
    await openNote("a");
    await user.type(textArea(), "abc");

    // Act
    await advance(AUTOSAVE_DELAY_MS);
    const statusWhileSaving = screen.queryByText("Сохраняется…");
    release();
    await advance(0);

    // Assert
    expect(statusWhileSaving).toBeInTheDocument();
    expect(screen.queryByText("Сохраняется…")).not.toBeInTheDocument();
    expect(screen.getByText("Сохранение: 0 минут назад")).toBeInTheDocument();
  });

  it("shows the server's error message when saving fails", async () => {
    // Arrange
    backend.addNote({ id: "a", title: "Заголовок", text: "" });
    backend.failUpdates(400, "Заголовок слишком длинный");
    const user = setup();
    await openNote("a");

    // Act
    await user.type(textArea(), "abc");
    await advance(AUTOSAVE_DELAY_MS);

    // Assert
    expect(screen.getByText("Ошибка сохранения: Заголовок слишком длинный")).toBeInTheDocument();
  });
});
