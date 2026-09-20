import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteSearchResult } from "../../api/types";
import { advanceTime as advance } from "../../test/advanceTime";
import { FakeNotesBackend } from "../../test/FakeNotesBackend";
import { renderWithProviders } from "../../test/renderWithProviders";
import { SearchWorkspace } from "../../test/SearchWorkspace";
import { server } from "../../test/server";
import { DOUBLE_SHIFT_INTERVAL_MS } from "../hooks/useDoubleShift";
import { SEARCH_DEBOUNCE_MS } from "../hooks/useNotesSearch";

// Поиск по заметкам — docs/docs/notes/web-ui.md, раздел "Поиск". Sut — поле поиска
// вместе с редактором и той же проводкой выбора, что в App.tsx (SearchWorkspace):
// что происходит с открытой заметкой и с фокусом, видно снаружи, а не по вызовам
// колбэков. Подменён только сам бэкенд (MSW), свои модули — настоящие.

const resultA: NoteSearchResult = {
  id: "a",
  title: [{ text: "Покупки", match: true }],
  snippet: [{ text: "молоко", match: false }],
};
const resultB: NoteSearchResult = {
  id: "b",
  title: [{ text: "Покупки 2", match: true }],
  snippet: [{ text: "хлеб", match: false }],
};
const resultC: NoteSearchResult = {
  id: "c",
  title: [{ text: "Другая", match: false }],
  snippet: [{ text: "сыр", match: false }],
};

describe("Notes search box", () => {
  let backend: FakeNotesBackend;

  beforeEach(() => {
    backend = new FakeNotesBackend();
    server.use(...backend.handlers);
    backend.addNote({ id: "a", title: "Покупки", text: "молоко" });
    backend.addNote({ id: "b", title: "Покупки 2", text: "хлеб" });
    backend.addNote({ id: "c", title: "Другая", text: "сыр" });
    backend.setSearchResults([resultA, resultB]);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const searchInput = () => screen.getByRole<HTMLInputElement>("textbox", { name: "Поиск по заметкам" });
  const clearButton = () => screen.queryByRole("button", { name: "Очистить поиск" });
  const dropdown = () => screen.queryByRole("listbox");
  // Строку выдачи ищем внутри списка: тот же текст есть и в открытой заметке.
  const row = (text: string) => within(screen.getByRole("listbox")).getByText(text);
  // Не document.querySelector("textarea"): автоподгонка высоты Mantine оставляет в body
  // служебную скрытую textarea (tabindex=-1), и она переживает тесты.
  const noteTextArea = () => document.querySelector<HTMLTextAreaElement>("textarea:not([tabindex='-1'])");

  // Печатает запрос и ждёт, пока он уйдёт на сервер и вернётся выдача.
  async function search(text: string) {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, delay: null });
    renderWithProviders(<SearchWorkspace />);
    await user.type(searchInput(), text);
    await settleSearch();
    return user;
  }

  async function settleSearch() {
    await advance(SEARCH_DEBOUNCE_MS);
    // Запрос уходит только в конце предыдущего шага (его запускает сработавший там же
    // таймер задержки), так что ответу нужен ещё один заход.
    await advance(0);
  }

  async function expectCursorAtStartOfNoteText() {
    expect(noteTextArea()).toHaveFocus();
    expect(noteTextArea()?.selectionStart).toBe(0);
    expect(noteTextArea()?.selectionEnd).toBe(0);
  }

  describe("what is shown", () => {
    it("does not search until three characters are typed", async () => {
      // Arrange
      // Act
      await search("по");

      // Assert
      expect(backend.searchQueries).toEqual([]);
      expect(dropdown()).not.toBeInTheDocument();
    });

    it("searches once three characters are typed", async () => {
      // Arrange
      // Act
      await search("пок");

      // Assert
      expect(backend.searchQueries).toEqual(["пок"]);
    });

    it("shows the title and the snippet of every result, with matches highlighted", async () => {
      // Arrange
      backend.setSearchResults([
        {
          id: "a",
          title: [
            { text: "Мои ", match: false },
            { text: "покуп", match: true },
            { text: "ки", match: false },
          ],
          snippet: [
            { text: "…надо сделать ", match: false },
            { text: "покуп", match: true },
            { text: "ки завтра…", match: false },
          ],
        },
      ]);

      // Act
      await search("покуп");

      // Assert
      expect(screen.getByText("Мои", { exact: false })).toBeInTheDocument();
      expect(screen.getByText("ки завтра…", { exact: false })).toBeInTheDocument();
      const highlighted = document.querySelectorAll("mark");
      expect([...highlighted].map((element) => element.textContent)).toEqual(["покуп", "покуп"]);
    });

    it("tells the user when nothing was found", async () => {
      // Arrange
      backend.setSearchResults([]);

      // Act
      await search("пок");

      // Assert
      expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();
    });

    it("shows the untitled placeholder for a note without a title", async () => {
      // Arrange
      backend.setSearchResults([{ id: "a", title: [], snippet: [{ text: "молоко", match: false }] }]);

      // Act
      await search("пок");

      // Assert
      expect(screen.getByText("Без названия")).toBeInTheDocument();
    });

    it("reports a failed search instead of an empty result", async () => {
      // Arrange
      backend.failSearch(500, "Всё плохо");

      // Act
      await search("пок");

      // Assert
      expect(screen.getByText("Не удалось выполнить поиск")).toBeInTheDocument();
    });
  });

  describe("opening a note", () => {
    it("opens the note but keeps the search open when a row is clicked", async () => {
      // Arrange
      const user = await search("пок");

      // Act
      await user.click(row("хлеб"));
      await advance(0);

      // Assert
      expect(screen.getByDisplayValue("Покупки 2")).toBeInTheDocument();
      expect(dropdown()).toBeInTheDocument();
      expect(searchInput()).toHaveValue("пок");
      expect(searchInput()).toHaveFocus();
    });

    it("opens the highlighted row on Enter and keeps the search open", async () => {
      // Arrange
      const user = await search("пок");

      // Act
      await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
      await advance(0);

      // Assert
      expect(screen.getByDisplayValue("Покупки 2")).toBeInTheDocument();
      expect(dropdown()).toBeInTheDocument();
      expect(searchInput()).toHaveValue("пок");
      expect(searchInput()).toHaveFocus();
    });

    it("opens the first row on Enter when no row is highlighted", async () => {
      // Arrange
      const user = await search("пок");

      // Act
      await user.keyboard("{Enter}");
      await advance(0);

      // Assert
      expect(screen.getByDisplayValue("Покупки")).toBeInTheDocument();
      expect(dropdown()).toBeInTheDocument();
      expect(searchInput()).toHaveFocus();
    });

    it("marks the row of the note that is open now", async () => {
      // Arrange
      const user = await search("пок");

      // Act
      await user.click(row("молоко"));
      await advance(0);

      // Assert
      const marks = within(screen.getByRole("listbox")).getAllByRole("img", { name: "Открыта в редакторе" });
      expect(marks).toHaveLength(1);
    });

    it("lets the user pick another row while the first note is still loading", async () => {
      // Arrange
      const release = backend.holdReads();
      const user = await search("пок");

      // Act
      await user.click(row("молоко"));
      await user.click(row("хлеб"));
      release();
      await advance(0);

      // Assert
      expect(screen.getByDisplayValue("Покупки 2")).toBeInTheDocument();
      expect(dropdown()).toBeInTheDocument();
      expect(searchInput()).toHaveValue("пок");
    });

    it("waits for the results of the typed text before opening the first row on Enter", async () => {
      // Arrange
      const user = await search("пок");
      backend.setSearchResults([resultC]);

      // Act
      await user.type(searchInput(), "у{Enter}");
      await settleSearch();
      // Открытие первой строки — ещё один шаг после прихода выдачи: заметке нужно загрузиться.
      await advance(0);

      // Assert
      expect(screen.getByDisplayValue("Другая")).toBeInTheDocument();
      expect(screen.queryByDisplayValue("Покупки")).not.toBeInTheDocument();
    });

    it("drops a pending Enter when the user keeps typing", async () => {
      // Arrange
      const user = await search("пок");
      backend.setSearchResults([resultC]);

      // Act
      await user.type(searchInput(), "у{Enter}х");
      await settleSearch();

      // Assert
      expect(screen.getByText("Выберите заметку слева или создайте новую")).toBeInTheDocument();
    });
  });

  describe("fixing the choice", () => {
    it("fixes the choice on a repeated Enter: clears the field, closes the list, cursor to the start of the text", async () => {
      // Arrange
      const user = await search("пок");
      await user.keyboard("{Enter}");
      await advance(0);

      // Act
      await user.keyboard("{Enter}");
      await advance(SEARCH_DEBOUNCE_MS);

      // Assert
      expect(searchInput()).toHaveValue("");
      expect(dropdown()).not.toBeInTheDocument();
      await expectCursorAtStartOfNoteText();
    });

    it("fixes the choice on a repeated click on the open note's row", async () => {
      // Arrange
      const user = await search("пок");
      await user.click(row("молоко"));
      await advance(0);

      // Act
      await user.click(row("молоко"));
      await advance(SEARCH_DEBOUNCE_MS);

      // Assert
      expect(searchInput()).toHaveValue("");
      expect(dropdown()).not.toBeInTheDocument();
      await expectCursorAtStartOfNoteText();
    });

    it("does not fix the choice when a different row is picked", async () => {
      // Arrange
      const user = await search("пок");
      await user.click(row("молоко"));
      await advance(0);

      // Act
      await user.click(row("хлеб"));
      await advance(0);

      // Assert
      expect(screen.getByDisplayValue("Покупки 2")).toBeInTheDocument();
      expect(searchInput()).toHaveValue("пок");
      expect(dropdown()).toBeInTheDocument();
      expect(noteTextArea()).not.toHaveFocus();
    });

    it("places the cursor once the note has loaded if the choice was fixed before that", async () => {
      // Arrange
      const release = backend.holdReads();
      const user = await search("пок");
      await user.click(row("молоко"));

      // Act
      await user.click(row("молоко"));
      await advance(SEARCH_DEBOUNCE_MS);
      const editorBeforeLoad = noteTextArea();
      release();
      await advance(0);

      // Assert
      expect(editorBeforeLoad).toBeNull();
      expect(searchInput()).toHaveValue("");
      await expectCursorAtStartOfNoteText();
    });

    it("does not place the cursor if another note was picked before the first one loaded", async () => {
      // Arrange
      const release = backend.holdReads();
      const user = await search("пок");
      await user.click(row("молоко"));
      await user.click(row("молоко"));
      await advance(SEARCH_DEBOUNCE_MS);

      // Act
      await user.type(searchInput(), "пок");
      await settleSearch();
      await user.click(row("хлеб"));
      release();
      await advance(0);

      // Assert
      expect(screen.getByDisplayValue("Покупки 2")).toBeInTheDocument();
      expect(noteTextArea()).not.toHaveFocus();
    });

    it("clears the field but neither switches the mode nor moves focus while the note is in view mode", async () => {
      // Arrange
      const user = await search("пок");
      await user.click(row("молоко"));
      await advance(0);
      await user.click(screen.getByRole("button", { name: "Просмотр" }));
      await user.click(searchInput());
      await settleSearch();

      // Act
      await user.click(row("молоко"));
      await advance(SEARCH_DEBOUNCE_MS);

      // Assert
      expect(searchInput()).toHaveValue("");
      expect(noteTextArea()).toBeNull();
      expect(screen.getByRole("button", { name: "Редактирование" })).toBeInTheDocument();
      expect(searchInput()).toHaveFocus();
    });
  });

  describe("jumping to the field with a double Shift", () => {
    async function renderWorkspace() {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, delay: null });
      renderWithProviders(<SearchWorkspace />);
      return user;
    }

    it("tells about the shortcut in the placeholder", async () => {
      // Arrange
      // Act
      await renderWorkspace();

      // Assert
      expect(searchInput()).toHaveAttribute("placeholder", "Поиск по заметкам · двойной Shift");
    });

    it("moves the cursor from the note text into the search field", async () => {
      // Arrange
      const user = await search("пок");
      await user.keyboard("{Enter}");
      await advance(0);
      await user.keyboard("{Enter}");
      await advance(SEARCH_DEBOUNCE_MS);
      await expectCursorAtStartOfNoteText();

      // Act
      await user.keyboard("{Shift}{Shift}");

      // Assert
      expect(searchInput()).toHaveFocus();
    });

    it("selects the whole query when the cursor comes from elsewhere", async () => {
      // Arrange
      const user = await search("пок");
      await user.click(document.body);
      await advance(SEARCH_DEBOUNCE_MS);

      // Act
      await user.keyboard("{Shift}{Shift}");

      // Assert
      expect(searchInput()).toHaveFocus();
      expect(searchInput().selectionStart).toBe(0);
      expect(searchInput().selectionEnd).toBe(3);
    });

    it("selects the whole query when the cursor is already in the field", async () => {
      // Arrange
      const user = await search("пок");

      // Act
      await user.keyboard("{Shift}{Shift}");

      // Assert
      expect(searchInput()).toHaveFocus();
      expect(searchInput().selectionStart).toBe(0);
      expect(searchInput().selectionEnd).toBe(3);
    });

    it("searches afresh, as on any return to the field", async () => {
      // Arrange
      const user = await search("пок");
      await user.click(document.body);
      await advance(SEARCH_DEBOUNCE_MS);

      // Act
      await user.keyboard("{Shift}{Shift}");
      await settleSearch();

      // Assert
      expect(backend.searchQueries).toEqual(["пок", "пок"]);
      expect(within(screen.getByRole("listbox")).getByText("молоко")).toBeInTheDocument();
    });

    it("does nothing when the second Shift comes too late", async () => {
      // Arrange
      const user = await renderWorkspace();

      // Act
      await user.keyboard("{Shift}");
      await advance(DOUBLE_SHIFT_INTERVAL_MS + 1);
      await user.keyboard("{Shift}");

      // Assert
      expect(searchInput()).not.toHaveFocus();
    });

    it("does not take a capital letter typed between two Shifts for a double Shift", async () => {
      // Arrange
      const user = await renderWorkspace();

      // Act
      await user.keyboard("{Shift>}П{/Shift}{Shift>}Р{/Shift}");

      // Assert
      expect(searchInput()).not.toHaveFocus();
    });

    it("does not take Shift held together with Alt (switching the keyboard layout) for a double Shift", async () => {
      // Arrange
      const user = await renderWorkspace();

      // Act
      await user.keyboard("{Alt>}{Shift}{Shift}{/Alt}");

      // Assert
      expect(searchInput()).not.toHaveFocus();
    });
  });

  describe("leaving the search without choosing", () => {
    it("clears the field on Escape, keeps focus in it and does not touch the open note", async () => {
      // Arrange
      const user = await search("пок");
      await user.keyboard("{Enter}");
      await advance(0);

      // Act
      await user.keyboard("{Escape}");
      await advance(SEARCH_DEBOUNCE_MS);

      // Assert
      expect(searchInput()).toHaveValue("");
      expect(dropdown()).not.toBeInTheDocument();
      expect(searchInput()).toHaveFocus();
      expect(screen.getByDisplayValue("Покупки")).toBeInTheDocument();
      expect(noteTextArea()).not.toHaveFocus();
    });

    it("clears the field with the cross button just like Escape", async () => {
      // Arrange
      const user = await search("пок");
      await user.keyboard("{Enter}");
      await advance(0);

      // Act
      await user.click(clearButton()!);
      await advance(SEARCH_DEBOUNCE_MS);

      // Assert
      expect(searchInput()).toHaveValue("");
      expect(dropdown()).not.toBeInTheDocument();
      expect(searchInput()).toHaveFocus();
      expect(screen.getByDisplayValue("Покупки")).toBeInTheDocument();
      expect(noteTextArea()).not.toHaveFocus();
    });

    it("shows the cross button only while the field is not empty", async () => {
      // Arrange
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, delay: null });
      renderWithProviders(<SearchWorkspace />);
      const beforeTyping = clearButton();

      // Act
      await user.type(searchInput(), "п");

      // Assert
      expect(beforeTyping).toBeNull();
      expect(clearButton()).toBeInTheDocument();
    });

    it("closes the list when the user clicks elsewhere but keeps the query", async () => {
      // Arrange
      const user = await search("пок");

      // Act
      await user.click(document.body);
      await advance(SEARCH_DEBOUNCE_MS);

      // Assert
      expect(dropdown()).not.toBeInTheDocument();
      expect(searchInput()).toHaveValue("пок");
    });

    it("searches again, without the previous results, when the user returns to the field", async () => {
      // Arrange
      const user = await search("пок");
      await user.click(document.body);
      await advance(SEARCH_DEBOUNCE_MS);
      const release = backend.holdSearches();

      // Act
      await user.click(searchInput());
      await advance(0);
      // Снимок в момент поиска: после release эти элементы уже заменятся.
      const whileSearching = {
        showsPreviousResults: within(screen.getByRole("listbox")).queryByText("молоко") !== null,
        showsProgress: screen.queryByText("Идёт поиск…") !== null,
      };
      release();
      await advance(0);

      // Assert
      expect(backend.searchQueries).toEqual(["пок", "пок"]);
      expect(whileSearching).toEqual({ showsPreviousResults: false, showsProgress: true });
      expect(within(screen.getByRole("listbox")).getByText("молоко")).toBeInTheDocument();
    });

    // Открывает заметку и ставит курсор в её текст — то место, из которого потом
    // уходят в поиск.
    async function openNoteAndPlaceCursor(position: number) {
      const user = await search("пок");
      await user.keyboard("{Enter}");
      await advance(0);
      await user.keyboard("{Enter}");
      await advance(SEARCH_DEBOUNCE_MS);
      noteTextArea()!.setSelectionRange(position, position);
      return user;
    }

    it("leaves the search on Escape in an empty field, returning the cursor where it came from", async () => {
      // Arrange
      const user = await openNoteAndPlaceCursor(3);
      await user.keyboard("{Shift}{Shift}");
      expect(searchInput()).toHaveFocus();

      // Act
      await user.keyboard("{Escape}");
      await advance(SEARCH_DEBOUNCE_MS);

      // Assert
      expect(noteTextArea()).toHaveFocus();
      expect(noteTextArea()?.selectionStart).toBe(3);
      expect(searchInput()).toHaveValue("");
    });

    it("takes two Escapes to leave when something is typed, even if nothing was found", async () => {
      // Arrange
      const user = await openNoteAndPlaceCursor(3);
      await user.keyboard("{Shift}{Shift}");
      backend.setSearchResults([]);
      await user.type(searchInput(), "ктулху");
      await settleSearch();
      expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();

      // Act
      await user.keyboard("{Escape}");
      const afterFirstEscape = { value: searchInput().value, keepsFocus: searchInput() === document.activeElement };
      await user.keyboard("{Escape}");
      await advance(SEARCH_DEBOUNCE_MS);

      // Assert
      expect(afterFirstEscape).toEqual({ value: "", keepsFocus: true });
      expect(noteTextArea()).toHaveFocus();
      expect(noteTextArea()?.selectionStart).toBe(3);
    });

    it("puts the cursor into the open note when the place it came from is gone", async () => {
      // Arrange: из заметки ушли в поиск, а там предпросмотром открыли другую —
      // прежний редактор размонтирован, возвращаться в него некуда.
      const user = await openNoteAndPlaceCursor(3);
      await user.keyboard("{Shift}{Shift}");
      await user.type(searchInput(), "пок");
      await settleSearch();
      await user.click(row("хлеб"));
      await advance(0);
      expect(screen.getByDisplayValue("Покупки 2")).toBeInTheDocument();

      // Act
      await user.keyboard("{Escape}");
      await user.keyboard("{Escape}");
      await advance(SEARCH_DEBOUNCE_MS);

      // Assert
      await expectCursorAtStartOfNoteText();
      expect(noteTextArea()).toHaveValue("хлеб");
    });
  });
});
