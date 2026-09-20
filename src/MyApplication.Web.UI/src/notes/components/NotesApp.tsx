import { useState } from "react";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useHotkey } from "../hooks/useHotkey";
import type { EditorFocusTarget, MobilePane } from "../hooks/useNoteSelection";
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
  // Enter в списке: курсор — в текст открытой заметки.
  onCommit: () => void;
  // Просьба поставить курсор в редактор — см. NoteEditor.
  editorFocus: EditorFocusTarget | null;
  onEditorFocusHandled: () => void;
  // Заметка удалена: открыть соседнюю (или ничего, если заметок не осталось).
  onDeleted: (neighbourNoteId: string | null) => void;
  // Телефон: какой из двух экранов показан сейчас и как вернуться к списку.
  mobilePane: MobilePane;
  onShowList: () => void;
}

export function NotesApp({
  selectedNoteId,
  onSelect,
  onCreated,
  onCommit,
  editorFocus,
  onEditorFocusHandled,
  onDeleted,
  mobilePane,
  onShowList,
}: NotesAppProps) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  // Просьба вернуть фокус в список (Esc из редактора). Счётчик, а не флаг: каждое
  // нажатие — отдельная просьба, в том числе повторное.
  const [listFocusRequest, setListFocusRequest] = useState(0);
  // Просьба удалить открытую заметку — из тулбара редактора (кнопка есть только на
  // телефоне). Тоже счётчик и по той же причине; спрашивает подтверждение и удаляет
  // список: соседи удаляемой заметки известны только ему.
  const [deleteRequest, setDeleteRequest] = useState(0);

  // Свернуть список в полоску можно только на широком экране: на телефоне он и так
  // уступает место заметке целиком.
  const listCollapsed = collapsed && !isMobile;

  useHotkey({ code: "Backslash", mod: true }, () => {
    if (isMobile) {
      return;
    }
    setCollapsed((value) => !value);
  });

  const handleLeaveEditor = () => {
    // Свёрнутый список разворачиваем: иначе фокусу некуда встать.
    setCollapsed(false);
    if (isMobile) {
      onShowList();
    }
    setListFocusRequest((value) => value + 1);
  };

  // На телефоне показан ровно один экран, но смонтированы оба: так список сохраняет
  // прокрутку и уже подгруженные страницы, а заметка — незаконченную правку, которую
  // иначе пришлось бы перечитывать с сервера после каждого «Назад».
  const listShown = !isMobile || mobilePane === "list";
  const editorShown = !isMobile || mobilePane === "editor";

  return (
    <div style={{ display: "flex", height: "100%", width: "100%" }}>
      {/* Скрытый список прячет не эта обёртка, а он сам: окно подтверждения удаления
          живёт в нём, а открывают его как раз тогда, когда на экране заметка. */}
      <div
        style={{
          flex: isMobile
            ? listShown
              ? "1 1 100%"
              : "0 0 0"
            : `0 0 ${listCollapsed ? COLLAPSED_LIST_WIDTH : EXPANDED_LIST_WIDTH}`,
          borderRight: isMobile ? undefined : "1px solid var(--mantine-color-gray-3)",
          minWidth: 0,
        }}
      >
        <NotesListPanel
          collapsed={listCollapsed}
          hidden={!listShown}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          selectedNoteId={selectedNoteId}
          onSelect={onSelect}
          onCreated={onCreated}
          onCommit={onCommit}
          onDeleted={onDeleted}
          focusRequest={listFocusRequest}
          deleteRequest={deleteRequest}
        />
      </div>
      <div style={{ display: editorShown ? "block" : "none", flex: isMobile ? "1 1 100%" : 1, minWidth: 0 }}>
        <NoteEditorPanel
          noteId={selectedNoteId}
          editorFocus={editorFocus}
          onEditorFocusHandled={onEditorFocusHandled}
          onLeaveToList={handleLeaveEditor}
          onBack={onShowList}
          onRequestDelete={() => setDeleteRequest((value) => value + 1)}
        />
      </div>
    </div>
  );
}
