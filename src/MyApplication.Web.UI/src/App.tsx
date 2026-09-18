import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotesApp } from "./notes/components/NotesApp";

import "@mantine/core/styles.css";

const queryClient = new QueryClient();

export function App() {
  return (
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <NotesApp />
      </QueryClientProvider>
    </MantineProvider>
  );
}
