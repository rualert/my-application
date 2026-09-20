import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { setAccessToken } from "../auth/tokenStore";
import { server } from "./server";
import { installMatchMedia, resetViewport } from "./viewport";

// Полифилы, без которых Mantine не рендерится в jsdom (см. mantine.dev/guides/vitest).
// matchMedia отвечает по ширине экрана, которую задаёт тест, — см. viewport.ts.
installMatchMedia();

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub;
// Textarea с autosize подписывается на document.fonts, в jsdom его нет.
Object.defineProperty(document, "fonts", {
  value: { addEventListener: () => {}, removeEventListener: () => {} },
});
window.HTMLElement.prototype.scrollIntoView = () => {};

// RTL ждёт `setTimeout(0)` после каждого действия user-event и продвигает
// фейковые часы только через глобальный `jest.advanceTimersByTime` — которого в
// Vitest нет, и при vi.useFakeTimers() любой `await user.…` виснет навсегда.
vi.stubGlobal("jest", { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) });

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  setAccessToken(null);
  resetViewport();
});

afterAll(() => server.close());
