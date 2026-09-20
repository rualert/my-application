import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

// Те же провайдеры, что в App.tsx, но со свежим QueryClient на каждый тест
// (иначе кэш протекает между тестами) и без повторов запросов.
// env="test" — штатный режим Mantine для тестов: без переходов и порталов. Иначе
// выпадающий список (Popover) в jsdom навсегда остаётся в display:none — переход
// не завершается, — так что запросы по роли его не видят, а закрытый список не
// убирается из DOM.
export function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrap = (node: ReactElement) => (
    <MantineProvider env="test">
      <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>
    </MantineProvider>
  );

  const result = render(wrap(ui));
  return {
    ...result,
    queryClient,
    rerender: (next: ReactElement) => result.rerender(wrap(next)),
  };
}
