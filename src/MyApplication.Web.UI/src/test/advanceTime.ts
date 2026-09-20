// Node-типы нужны только этому помощнику (setImmediate); tsconfig.app.json их
// намеренно не подключает, чтобы код приложения не мог случайно взять Node API.
/// <reference types="node" />

import { act } from "@testing-library/react";
import { vi } from "vitest";

// Двигает фейковые часы (vi.useFakeTimers) и даёт настоящему event loop
// прокрутиться, чтобы сетевой ответ (MSW) и связанные обновления React успели
// отработать. Для этого в useFakeTimers должен остаться настоящим setImmediate.
export async function advanceTime(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    for (let turn = 0; turn < 5; turn++) {
      await new Promise<void>((resolve) => setImmediate(resolve));
      await vi.advanceTimersByTimeAsync(0);
    }
  });
}
