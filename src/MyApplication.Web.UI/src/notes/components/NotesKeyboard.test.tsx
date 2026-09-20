import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { FakeNotesBackend } from "../../test/FakeNotesBackend";
import { NotesWorkspace } from "../../test/NotesWorkspace";
import { renderWithProviders } from "../../test/renderWithProviders";
import { server } from "../../test/server";

// Управление приложением с клавиатуры — docs/docs/notes/web-ui.md, «Горячие клавиши».
// Sut — список заметок вместе с редактором и той же проводкой выбора, что в App.tsx
// (NotesWorkspace): судим по тому, что открыто и где оказался фокус, а не по вызовам
// колбэков. Подменён только бэкенд (MSW), свои модули — настоящие.
describe("Keyboard control", () => {
  let backend: FakeNotesBackend;

  beforeEach(() => {
    backend = new FakeNotesBackend();
    server.use(...backend.handlers);
    // Список отдаётся от новых к старым: сверху «Идеи», под ними «Покупки».
    backend.addNote({ id: "a", title: "Покупки", text: "молоко" });
    backend.addNote({ id: "b", title: "Идеи", text: "переписать всё" });
  });

  // Сочетания ловятся по положению клавиши (event.code), поэтому шлём код явно:
  // набранный символ и раскладка тут ни при чём.
  const pressHotkey = (init: KeyboardEventInit) => fireEvent.keyDown(window, init);

  const note = (title: string) => screen.getByRole("option", { name: title });
  const titleField = () => screen.getByPlaceholderText("Без названия");
  // Не document.querySelector("textarea"): автоподгонка высоты Mantine оставляет в body
  // служебную скрытую textarea (tabindex=-1), и она переживает тесты.
  const noteTextArea = () => document.querySelector<HTMLTextAreaElement>("textarea:not([tabindex='-1'])");

  const openFromList = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
    await user.click(await screen.findByText(title));
    await waitFor(() => expect(noteTextArea()).not.toBeNull());
  };

  it("moves through the list with arrows, opening each note", async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<NotesWorkspace />);
    await openFromList(user, "Идеи");

    // Act
    await user.keyboard("{ArrowDown}");

    // Assert
    await waitFor(() => expect(screen.getByDisplayValue("Покупки")).toBeInTheDocument());
    expect(note("Покупки")).toHaveFocus();
    expect(note("Покупки")).toHaveAttribute("aria-selected", "true");
  });

  it("moves back up the list with the up arrow", async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<NotesWorkspace />);
    await openFromList(user, "Покупки");

    // Act
    await user.keyboard("{ArrowUp}");

    // Assert
    await waitFor(() => expect(screen.getByDisplayValue("Идеи")).toBeInTheDocument());
    expect(note("Идеи")).toHaveFocus();
  });

  it("puts the cursor into the text of the open note on Enter in the list", async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<NotesWorkspace />);
    await openFromList(user, "Покупки");

    // Act
    await user.keyboard("{Enter}");

    // Assert
    await waitFor(() => expect(noteTextArea()).toHaveFocus());
    expect(noteTextArea()).toHaveValue("молоко");
  });

  it("returns the focus from the editor back to the list on Escape", async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<NotesWorkspace />);
    await openFromList(user, "Покупки");
    await user.click(noteTextArea()!);
    expect(noteTextArea()).toHaveFocus();

    // Act
    await user.keyboard("{Escape}");

    // Assert
    await waitFor(() => expect(note("Покупки")).toHaveFocus());
  });

  it("creates a note with Alt+N and puts the cursor into its title", async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<NotesWorkspace />);
    await openFromList(user, "Покупки");

    // Act
    pressHotkey({ code: "KeyN", key: "n", altKey: true });

    // Assert
    await waitFor(() => expect(titleField()).toHaveFocus());
    expect(backend.creations).toEqual([{ title: null, text: "" }]);
  });

  it("switches between view and edit mode with Ctrl+E, keeping the cursor in the note", async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<NotesWorkspace />);
    await openFromList(user, "Покупки");

    // Act
    pressHotkey({ code: "KeyE", key: "e", ctrlKey: true });

    // Assert
    await waitFor(() => expect(screen.queryByPlaceholderText("Без названия")).not.toBeInTheDocument());
    pressHotkey({ code: "KeyE", key: "e", ctrlKey: true });
    await waitFor(() => expect(noteTextArea()).toHaveFocus());
  });

  it("collapses and expands the list with Ctrl+backslash", async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<NotesWorkspace />);
    await openFromList(user, "Покупки");

    // Act
    pressHotkey({ code: "Backslash", key: "\\", ctrlKey: true });

    // Assert
    await waitFor(() => expect(screen.getByLabelText("Показать список заметок")).toBeInTheDocument());
    expect(screen.queryByRole("option", { name: "Покупки" })).not.toBeInTheDocument();
    pressHotkey({ code: "Backslash", key: "\\", ctrlKey: true });
    await waitFor(() => expect(note("Покупки")).toBeInTheDocument());
  });

  it("expands the collapsed list when Escape asks to return to it", async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<NotesWorkspace />);
    await openFromList(user, "Покупки");
    await user.click(noteTextArea()!);
    pressHotkey({ code: "Backslash", key: "\\", ctrlKey: true });
    await waitFor(() => expect(screen.getByLabelText("Показать список заметок")).toBeInTheDocument());

    // Act
    await user.keyboard("{Escape}");

    // Assert
    await waitFor(() => expect(note("Покупки")).toHaveFocus());
  });

  it("deletes the note after a confirmation and opens the neighbouring one", async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<NotesWorkspace />);
    await openFromList(user, "Идеи");

    // Act
    await user.keyboard("{Delete}");
    // Фокус в окне подтверждения стоит на «Удалить»: подтверждают одним Enter.
    await waitFor(() => expect(screen.getByRole("button", { name: "Удалить" })).toHaveFocus());
    await user.keyboard("{Enter}");

    // Assert
    await waitFor(() => expect(backend.deletions).toEqual(["b"]));
    await waitFor(() => expect(note("Покупки")).toHaveFocus());
    expect(screen.queryByRole("option", { name: "Идеи" })).not.toBeInTheDocument();
    expect(await screen.findByDisplayValue("Покупки")).toBeInTheDocument();
  });

  it("keeps the note when the confirmation is dismissed", async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<NotesWorkspace />);
    await openFromList(user, "Идеи");

    // Act
    await user.keyboard("{Delete}");
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await user.keyboard("{Escape}");

    // Assert
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(backend.deletions).toEqual([]);
    expect(note("Идеи")).toHaveFocus();
  });
});
