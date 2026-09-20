import { NoteEditorPanel } from "../notes/components/NoteEditorPanel";
import { NotesSearchBox } from "../notes/components/NotesSearchBox";
import { useNoteSelection } from "../notes/hooks/useNoteSelection";

// Поле поиска и редактор с той же проводкой (useNoteSelection), что в App.tsx, но без
// экрана входа и списка заметок: поиск и то, что он делает с открытой заметкой, —
// единственный объект тестов.
export function SearchWorkspace() {
  const selection = useNoteSelection();

  return (
    <>
      <NotesSearchBox
        openNoteId={selection.selectedNoteId}
        onPreview={selection.select}
        onCommit={selection.requestTextFocus}
      />
      <NoteEditorPanel
        noteId={selection.selectedNoteId}
        editorFocus={selection.editorFocus}
        onEditorFocusHandled={selection.handleEditorFocusHandled}
      />
    </>
  );
}
