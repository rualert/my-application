import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

// Те же провайдеры, что в App.tsx, но со свежим QueryClient на каждый тест
// (иначе кэш протекает между тестами) и без повторов запросов.
export function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrap = (node: ReactElement) => (
    <MantineProvider>
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
