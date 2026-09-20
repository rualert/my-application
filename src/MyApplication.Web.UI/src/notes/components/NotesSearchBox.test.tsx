import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advanceTime as advance } from "../../test/advanceTime";
import { FakeNotesBackend } from "../../test/FakeNotesBackend";
import { renderWithProviders } from "../../test/renderWithProviders";
import { server } from "../../test/server";
import { SEARCH_DEBOUNCE_MS } from "../hooks/useNotesSearch";
import { NotesSearchBox } from "./NotesSearchBox";

// Поиск по заметкам — docs/docs/notes/web-ui.md, раздел "Поиск". Sut —
// NotesSearchBox целиком: поле, запрос к серверу и выпадающий список вместе.
// Подменён только сам бэкенд (MSW), свои модули — настоящие.

describe("Notes search box", () => {
  let backend: FakeNotesBackend;
  let onSelect: Mock<(id: string) => void>;

  beforeEach(() => {
    backend = new FakeNotesBackend();
    server.use(...backend.handlers);
    onSelect = vi.fn<(id: string) => void>();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime, delay: null });
  const searchInput = () => screen.getByRole("textbox", { name: "Поиск по заметкам" });

  // Печатает запрос и ждёт, пока он уйдёт на сервер и вернётся выдача.
  async function search(text: string) {
    const user = setup();
    renderWithProviders(<NotesSearchBox onSelect={onSelect} />);
    await user.type(searchInput(), text);
    await advance(SEARCH_DEBOUNCE_MS);
    // Запрос уходит только в самом конце предыдущего шага (его запускает
    // сработавший там же таймер задержки), так что ответу нужен ещё один заход.
    await advance(0);
    return user;
  }

  it("does not search until three characters are typed", async () => {
    // Arrange
    // Act
    await search("по");

    // Assert
    expect(backend.searchQueries).toEqual([]);
    expect(screen.queryByText("Ничего не найдено")).not.toBeInTheDocument();
  });

  it("searches once three characters are typed", async () => {
    // Arrange
    backend.setSearchResults([]);

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

  it("opens the note when its row is clicked", async () => {
    // Arrange
    backend.setSearchResults([
      { id: "a", title: [{ text: "Покупки", match: true }], snippet: [{ text: "молоко", match: false }] },
      { id: "b", title: [{ text: "Покупки 2", match: true }], snippet: [{ text: "хлеб", match: false }] },
    ]);

    // Act
    const user = await search("пок");
    await user.click(screen.getByText("хлеб"));

    // Assert
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("opens the row selected with the arrow keys on Enter", async () => {
    // Arrange
    backend.setSearchResults([
      { id: "a", title: [{ text: "Покупки", match: true }], snippet: [{ text: "молоко", match: false }] },
      { id: "b", title: [{ text: "Покупки 2", match: true }], snippet: [{ text: "хлеб", match: false }] },
    ]);

    // Act
    const user = await search("пок");
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    // Assert
    expect(onSelect).toHaveBeenCalledWith("b");
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

  it("clears the field and closes the list on Escape", async () => {
    // Arrange
    backend.setSearchResults([
      { id: "a", title: [{ text: "Покупки", match: true }], snippet: [{ text: "молоко", match: false }] },
    ]);

    // Act
    const user = await search("пок");
    await user.keyboard("{Escape}");
    await advance(SEARCH_DEBOUNCE_MS);

    // Assert
    expect(searchInput()).toHaveValue("");
    expect(screen.queryByText("молоко")).not.toBeInTheDocument();
  });
});
