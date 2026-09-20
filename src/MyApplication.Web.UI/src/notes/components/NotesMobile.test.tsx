import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { FakeNotesBackend } from "../../test/FakeNotesBackend";
import { NotesWorkspace } from "../../test/NotesWorkspace";
import { renderWithProviders } from "../../test/renderWithProviders";
import { server } from "../../test/server";
import { setMobileViewport } from "../../test/viewport";

// Интерфейс для телефона — docs/docs/notes/web-ui.md, «Интерфейс для телефона».
// Sut — тот же NotesWorkspace, что и в тестах клавиатуры (список и редактор с настоящей
// проводкой выбора из App.tsx); отличается только ширина экрана. Судим по тому, что
// видно на экране, а не по вызовам колбэков: обе панели смонтированы всегда, и вопрос
// ровно в том, которая из них показана.
describe("Phone layout", () => {
  let backend: FakeNotesBackend;

  beforeEach(() => {
    // До render: ширину экрана читают при первом рендере.
    setMobileViewport();
    backend = new FakeNotesBackend();
    server.use(...backend.handlers);
    // Список отдаётся от новых к старым: сверху «Идеи», под ними «Покупки».
    backend.addNote({ id: "a", title: "Покупки", text: "молоко" });
    backend.addNote({ id: "b", title: "Идеи", text: "переписать всё" });
  });

  const list = () => screen.getByLabelText("Заметки");
  const noteRow = (title: string) => within(list()).getByText(title).closest("[data-note-id]");
  const titleField = () => screen.getByPlaceholderText("Без названия");

  const openFromList = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
    await user.click(await screen.findByText(title));
    await waitFor(() => expect(screen.getByDisplayValue(title)).toBeVisible());
  };

  it("shows the note instead of the list once one is picked", async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<NotesWorkspace />);

    // Act
    await openFromList(user, "Покупки");

    // Assert
    expect(list()).not.toBeVisible();
    expect(screen.getByDisplayValue("Покупки")).toBeVisible();
  });

  it("returns to the list by the back button, keeping the note selected", async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<NotesWorkspace />);
    await openFromList(user, "Покупки");

    // Act
    await user.click(screen.getByLabelText("Назад к списку"));

    // Assert
    await waitFor(() => expect(list()).toBeVisible());
    expect(screen.getByDisplayValue("Покупки")).not.toBeVisible();
    expect(noteRow("Покупки")).toHaveAttribute("aria-selected", "true");
  });

  it("keeps an edit that has not reached the server while the list is shown", async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<NotesWorkspace />);
    await openFromList(user, "Покупки");
    await user.click(screen.getByDisplayValue("Покупки"));
    await user.keyboard(" и хлеб");
    // Ответ на сохранение (уходит по потере фокуса) держим: в кэше на всё время теста
    // лежит прежний заголовок, так что напечатанное переживает уход к списку только
    // потому, что редактор не размонтировался.
    backend.holdUpdates();

    // Act
    await user.click(screen.getByLabelText("Назад к списку"));
    await waitFor(() => expect(list()).toBeVisible());
    await user.click(noteRow("Покупки")!);

    // Assert
    await waitFor(() => expect(screen.getByDisplayValue("Покупки и хлеб")).toBeVisible());
  });

  it("has neither the collapse nor the delete button in the list toolbar", async () => {
    // Arrange
    renderWithProviders(<NotesWorkspace />);
    await screen.findByText("Покупки");

    // Act
    // Сворачивать список на телефоне нечем — ни кнопкой, ни сочетанием клавиш.
    fireEvent.keyDown(window, { code: "Backslash", key: "\\", ctrlKey: true });

    // Assert
    expect(screen.queryByLabelText("Свернуть список")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Показать список заметок")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Удалить выбранную")).not.toBeInTheDocument();
    expect(list()).toBeVisible();
  });

  it("deletes the open note from its own toolbar and returns to the list", async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<NotesWorkspace />);
    await openFromList(user, "Идеи");

    // Act
    await user.click(screen.getByLabelText("Удалить заметку"));
    // Фокус в окне подтверждения стоит на «Удалить»: подтверждают одним Enter.
    await waitFor(() => expect(screen.getByRole("button", { name: "Удалить" })).toHaveFocus());
    await user.keyboard("{Enter}");

    // Assert
    await waitFor(() => expect(backend.deletions).toEqual(["b"]));
    await waitFor(() => expect(list()).toBeVisible());
    expect(within(list()).queryByText("Идеи")).not.toBeInTheDocument();
  });

  it("opens a created note right away, with the cursor in its title", async () => {
    // Arrange
    const user = userEvent.setup();
    renderWithProviders(<NotesWorkspace />);
    await screen.findByText("Покупки");

    // Act
    await user.click(screen.getByLabelText("Добавить заметку"));

    // Assert
    await waitFor(() => expect(titleField()).toHaveFocus());
    expect(titleField()).toBeVisible();
    expect(list()).not.toBeVisible();
  });
});
