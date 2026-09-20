import { NotesApp } from "../notes/components/NotesApp";
import { useNoteSelection } from "../notes/hooks/useNoteSelection";

// Список заметок и редактор с той же проводкой (useNoteSelection), что в App.tsx, но без
// экрана входа и шапки: создание и выбор заметок из списка — единственный объект тестов.
export function NotesWorkspace() {
  const selection = useNoteSelection();

  return (
    <div style={{ height: "100vh" }}>
      <NotesApp
        selectedNoteId={selection.selectedNoteId}
        onSelect={selection.select}
        onCreated={selection.selectCreated}
        onCommit={selection.requestTextFocus}
        editorFocus={selection.editorFocus}
        onEditorFocusHandled={selection.handleEditorFocusHandled}
      />
    </div>
  );
}
