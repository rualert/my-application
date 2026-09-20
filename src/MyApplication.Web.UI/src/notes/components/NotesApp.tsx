import { useState } from "react";
import type { EditorFocusTarget } from "../hooks/useNoteSelection";
import { NoteEditorPanel } from "./NoteEditorPanel";
import { NotesListPanel } from "./NotesListPanel";

const EXPANDED_LIST_WIDTH = "30%";
const COLLAPSED_LIST_WIDTH = "48px";

interface NotesAppProps {
  // Выбранная заметка живёт выше: её выбирают и из списка, и из поиска в шапке.
  selectedNoteId: string | null;
  onSelect: (id: string | null) => void;
  // Открыть только что созданную заметку (курсор — в её заголовок).
  onCreated: (id: string) => void;
  // Просьба поставить курсор в редактор — см. NoteEditor.
  editorFocus: EditorFocusTarget | null;
  onEditorFocusHandled: () => void;
}

export function NotesApp({ selectedNoteId, onSelect, onCreated, editorFocus, onEditorFocusHandled }: NotesAppProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ display: "flex", height: "100%", width: "100%" }}>
      <div
        style={{
          flex: `0 0 ${collapsed ? COLLAPSED_LIST_WIDTH : EXPANDED_LIST_WIDTH}`,
          borderRight: "1px solid var(--mantine-color-gray-3)",
          minWidth: 0,
        }}
      >
        <NotesListPanel
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          selectedNoteId={selectedNoteId}
          onSelect={onSelect}
          onCreated={onCreated}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <NoteEditorPanel
          noteId={selectedNoteId}
          editorFocus={editorFocus}
          onEditorFocusHandled={onEditorFocusHandled}
        />
      </div>
    </div>
  );
}
