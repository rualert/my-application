import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { FakeNotesBackend } from "../../test/FakeNotesBackend";
import { NotesWorkspace } from "../../test/NotesWorkspace";
import { renderWithProviders } from "../../test/renderWithProviders";
import { server } from "../../test/server";

// Создание заметки — docs/docs/notes/web-ui.md, раздел "Создание заметки". Sut — список
// заметок вместе с редактором и той же проводкой выбора, что в App.tsx (NotesWorkspace):
// куда попал курсор, видно по фокусу, а не по вызовам колбэков. Подменён только сам
// бэкенд (MSW), свои модули — настоящие.
describe("Creating a note", () => {
  let backend: FakeNotesBackend;

  beforeEach(() => {
    backend = new FakeNotesBackend();
    server.use(...backend.handlers);
    backend.addNote({ id: "a", title: "Покупки", text: "молоко" });
  });

  const addButton = () => screen.getByRole("button", { name: "Добавить заметку" });
  const titleField = () => screen.getByPlaceholderText("Без названия");
  // Не document.querySelector("textarea"): автоподгонка высоты Mantine оставляет в body
  // служебную скрытую textarea (tabindex=-1), и она переживает тесты.
  const noteTextArea = () => document.querySelector<HTMLTextAreaElement>("textarea:not([tabindex='-1'])");

  it("puts the cursor into the title of the new note", async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<NotesWorkspace />);

    // Act
    await user.click(addButton());

    // Assert
    await waitFor(() => expect(titleField()).toHaveFocus());
    expect(backend.creations).toEqual([{ title: null, text: "" }]);
  });

  it("moves the cursor from the text of the previous note into the title of the new one", async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<NotesWorkspace />);
    await user.click(await screen.findByText("Покупки"));
    await waitFor(() => expect(noteTextArea()).not.toBeNull());
    await user.click(noteTextArea()!);
    expect(noteTextArea()).toHaveFocus();

    // Act
    await user.click(addButton());

    // Assert
    await waitFor(() => expect(titleField()).toHaveFocus());
    expect(titleField()).toHaveValue("");
  });

  it("switches from view mode to edit mode to put the cursor into the title", async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<NotesWorkspace />);
    await user.click(await screen.findByText("Покупки"));
    await user.click(await screen.findByRole("button", { name: "Просмотр" }));
    expect(screen.queryByPlaceholderText("Без названия")).not.toBeInTheDocument();

    // Act
    await user.click(addButton());

    // Assert
    await waitFor(() => expect(titleField()).toHaveFocus());
  });

  it("does not put the cursor into the title when an existing note is opened", async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<NotesWorkspace />);

    // Act
    await user.click(await screen.findByText("Покупки"));

    // Assert
    expect(await screen.findByDisplayValue("Покупки")).not.toHaveFocus();
  });
});
