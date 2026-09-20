import { Loader, MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppHeader } from "./auth/AppHeader";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { LoginScreen } from "./auth/LoginScreen";
import { NotesApp } from "./notes/components/NotesApp";
import { useNoteSelection } from "./notes/hooks/useNoteSelection";

import "@mantine/core/styles.css";

const queryClient = new QueryClient();

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  // Выбранную заметку задаёт и список, и поиск в шапке — поэтому она живёт здесь.
  const selection = useNoteSelection();

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <Loader />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw" }}>
      <AppHeader
        openNoteId={selection.selectedNoteId}
        onPreviewNote={selection.select}
        onCommitNote={selection.requestEditorFocus}
      />
      <div style={{ flex: 1, minHeight: 0 }}>
        <NotesApp
          selectedNoteId={selection.selectedNoteId}
          onSelect={selection.select}
          editorFocusRequested={selection.editorFocusRequested}
          onEditorFocusHandled={selection.handleEditorFocusHandled}
        />
      </div>
    </div>
  );
}

export function App() {
  return (
    <MantineProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </QueryClientProvider>
    </MantineProvider>
  );
}
