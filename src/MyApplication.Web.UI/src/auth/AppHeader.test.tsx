import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import { server } from "../test/server";
import { setMobileViewport } from "../test/viewport";
import { AppHeader } from "./AppHeader";
import { AuthProvider } from "./AuthProvider";

const noop = () => {};

// Состав шапки — docs/docs/notes/web-ui.md, «Шапка приложения» и «Интерфейс для
// телефона». Sut — шапка с настоящим AuthProvider: подменён только бэкенд (MSW),
// сессия восстанавливается тем же запросом /Auth/refresh, что и в приложении.
describe("App header", () => {
  beforeEach(() => {
    server.use(
      http.post("/Auth/refresh", () =>
        HttpResponse.json({ accessToken: "token", expiresAt: "2026-01-01T00:00:00.000Z", userName: "Алиса" }),
      ),
    );
  });

  const renderHeader = () =>
    renderWithProviders(
      <AuthProvider>
        <AppHeader openNoteId={null} onPreviewNote={noop} onCommitNote={noop} />
      </AuthProvider>,
    );

  it("shows the application name and the user name on a wide screen", async () => {
    // Arrange

    // Act
    renderHeader();

    // Assert
    expect(await screen.findByText("Алиса")).toBeInTheDocument();
    expect(screen.getByText("MyNotesApp")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Поиск по заметкам · двойной Shift")).toBeInTheDocument();
  });

  it("gives the whole header to the search on a phone", async () => {
    // Arrange
    setMobileViewport();

    // Act
    renderHeader();

    // Assert
    expect(await screen.findByLabelText("Меню пользователя")).toBeInTheDocument();
    expect(screen.queryByText("MyNotesApp")).not.toBeInTheDocument();
    expect(screen.queryByText("Алиса")).not.toBeInTheDocument();
    // Про двойной Shift на телефоне не напоминаем: клавиатуры может не быть вовсе.
    expect(screen.getByPlaceholderText("Поиск по заметкам")).toBeInTheDocument();
  });

  it("keeps the user name and the logout behind the user menu on a phone", async () => {
    // Arrange
    setMobileViewport();
    const user = userEvent.setup();
    renderHeader();

    // Act
    await user.click(await screen.findByLabelText("Меню пользователя"));

    // Assert
    expect(await screen.findByText("Алиса")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Выйти" })).toBeInTheDocument();
  });
});
