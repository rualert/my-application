import { useState } from "react";
import { NoteEditorPanel } from "./NoteEditorPanel";
import { NotesListPanel } from "./NotesListPanel";

const EXPANDED_LIST_WIDTH = "30%";
const COLLAPSED_LIST_WIDTH = "48px";

export function NotesApp() {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw" }}>
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
          onSelect={setSelectedNoteId}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <NoteEditorPanel noteId={selectedNoteId} />
      </div>
    </div>
  );
}
