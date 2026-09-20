import { Loader, MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppHeader } from "./auth/AppHeader";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { LoginScreen } from "./auth/LoginScreen";
import { useIsMobile } from "./hooks/useIsMobile";
import { HotkeysHelp } from "./notes/components/HotkeysHelp";
import { NotesApp } from "./notes/components/NotesApp";
import { useNoteSelection } from "./notes/hooks/useNoteSelection";

import "@mantine/core/styles.css";

const queryClient = new QueryClient();

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  // Выбранную заметку задаёт и список, и поиск в шапке — поэтому она живёт здесь.
  const selection = useNoteSelection();
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh" }}>
        <Loader />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    // 100dvh, а не 100vh: на телефоне 100vh больше видимой части экрана на высоту
    // адресной строки браузера, и низ приложения (статус сохранения) уезжает за край.
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", width: "100vw" }}>
      <AppHeader
        openNoteId={selection.selectedNoteId}
        onPreviewNote={selection.select}
        onCommitNote={selection.requestTextFocus}
      />
      <div style={{ flex: 1, minHeight: 0 }}>
        <NotesApp
          selectedNoteId={selection.selectedNoteId}
          onSelect={selection.select}
          onCreated={selection.selectCreated}
          onCommit={selection.requestTextFocus}
          editorFocus={selection.editorFocus}
          onEditorFocusHandled={selection.handleEditorFocusHandled}
          onDeleted={selection.selectAfterDelete}
          mobilePane={selection.mobilePane}
          onShowList={selection.showList}
        />
      </div>
      {/* Окно с горячими клавишами — подсказка для работы с клавиатурой, которой
          на телефоне обычно нет. */}
      {!isMobile && <HotkeysHelp />}
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
