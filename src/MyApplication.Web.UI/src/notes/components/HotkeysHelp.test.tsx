import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { HotkeysHelp } from "./HotkeysHelp";

// Окно со списком горячих клавиш — docs/docs/notes/web-ui.md, «Горячие клавиши».
describe("Hotkeys help", () => {
  // Сочетание ловится по положению клавиши (event.code), а не по символу.
  const pressHelpHotkey = () => fireEvent.keyDown(window, { code: "Slash", key: "/", ctrlKey: true });

  it("opens on Ctrl+slash and lists the shortcuts", async () => {
    // Arrange
    renderWithProviders(<HotkeysHelp />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Act
    pressHelpHotkey();

    // Assert
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Создать заметку");
    expect(dialog).toHaveTextContent("Вернуться в список");
  });

  it("closes on the same shortcut", async () => {
    // Arrange
    renderWithProviders(<HotkeysHelp />);
    pressHelpHotkey();
    await screen.findByRole("dialog");

    // Act
    pressHelpHotkey();

    // Assert
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
