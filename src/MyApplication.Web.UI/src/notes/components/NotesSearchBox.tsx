import { CloseButton, Combobox, Group, Loader, ScrollArea, Stack, Text, TextInput, useCombobox } from "@mantine/core";
import { Check, Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import { UNTITLED_TITLE } from "../domain";
import { MIN_SEARCH_QUERY_LENGTH, useNotesSearch } from "../hooks/useNotesSearch";
import { HighlightedText } from "./HighlightedText";

const DROPDOWN_MAX_HEIGHT_PX = 320;

interface NotesSearchBoxProps {
  // Заметка, открытая сейчас в редакторе: её строка в выдаче помечена, а Enter
  // или нажатие на неё фиксирует выбор (а не открывает заметку заново).
  openNoteId: string | null;
  // Открыть заметку в редакторе, оставаясь в поиске.
  onPreview: (id: string) => void;
  // Зафиксировать выбор: курсор — в редактор.
  onCommit: () => void;
}

/**
 * Поле поиска по заметкам в шапке приложения (docs/docs/notes/web-ui.md, «Поиск»).
 * От трёх символов показывает выпадающий список найденного — заголовок и фрагмент
 * текста с подсвеченными совпадениями. Выбор идёт в два шага: первое нажатие на
 * строку (или Enter) открывает заметку, не закрывая поиск, повторное — по уже
 * открытой заметке — фиксирует выбор: поле очищается, курсор уходит в редактор.
 */
export function NotesSearchBox({ openNoteId, onPreview, onCommit }: NotesSearchBoxProps) {
  const [query, setQuery] = useState("");
  // Enter нажали, а выдача по набранному тексту ещё не пришла: ждём её, чтобы открыть
  // первую строку именно этой выдачи, а не прежней.
  const [enterPending, setEnterPending] = useState(false);
  const search = useNotesSearch(query);
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });

  const clear = () => {
    setQuery("");
    setEnterPending(false);
    combobox.closeDropdown();
    combobox.targetRef.current?.focus();
  };

  const commit = () => {
    setQuery("");
    setEnterPending(false);
    combobox.closeDropdown();
    onCommit();
  };

  const activate = (id: string) => {
    if (id === openNoteId) {
      commit();
    } else {
      onPreview(id);
    }
  };

  useEffect(() => {
    if (!enterPending || !search.isSettled) {
      return;
    }
    setEnterPending(false);
    const first = search.results[0];
    if (first) {
      activate(first.id);
    }
  }, [enterPending, search.isSettled, search.results]);

  const activateFirstResult = () => {
    if (query.trim().length < MIN_SEARCH_QUERY_LENGTH) {
      return;
    }
    combobox.openDropdown();
    if (!search.isSettled) {
      setEnterPending(true);
      return;
    }
    const first = search.results[0];
    if (first) {
      activate(first.id);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      clear();
      return;
    }
    // Enter на выделенной строке обрабатывает сам Combobox (onOptionSubmit); здесь —
    // только Enter, когда ничего не выделено: он открывает первую строку.
    if (event.key === "Enter" && !event.nativeEvent.isComposing && combobox.getSelectedOptionIndex() === -1) {
      event.preventDefault();
      activateFirstResult();
    }
  };

  const options = search.results.map((result) => {
    const isOpen = result.id === openNoteId;
    return (
      <Combobox.Option value={result.id} key={result.id}>
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text size="sm" fw={500} c={result.title.length === 0 ? "dimmed" : undefined}>
              {result.title.length === 0 ? UNTITLED_TITLE : <HighlightedText segments={result.title} />}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={2}>
              <HighlightedText segments={result.snippet} />
            </Text>
          </Stack>
          {isOpen && (
            <span role="img" aria-label="Открыта в редакторе" title="Открыта в редакторе" style={{ lineHeight: 0 }}>
              <Check size={14} />
            </span>
          )}
        </Group>
      </Combobox.Option>
    );
  });

  const showLoader = search.isLoading;
  const showClear = query.length > 0;

  return (
    <Combobox store={combobox} onOptionSubmit={activate}>
      <Combobox.Target>
        <TextInput
          aria-label="Поиск по заметкам"
          placeholder="Поиск по заметкам"
          leftSection={<Search size={16} />}
          rightSection={
            showLoader || showClear ? (
              <Group gap={4} wrap="nowrap">
                {showLoader && <Loader size="xs" />}
                {showClear && (
                  // mousedown не отбираем у поля фокус: крестик очищает, а не уводит из поля.
                  <CloseButton
                    size="sm"
                    aria-label="Очистить поиск"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={clear}
                  />
                )}
              </Group>
            ) : null
          }
          rightSectionWidth={56}
          rightSectionPointerEvents="all"
          value={query}
          w="100%"
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            // Дальнейший набор отменяет ожидающий Enter: он был про прежний текст.
            setEnterPending(false);
            combobox.openDropdown();
            combobox.resetSelectedOption();
          }}
          onFocus={() => {
            // Возвращение в поле — новый заход: выдача не берётся из памяти, поиск идёт заново.
            search.restart();
            combobox.openDropdown();
          }}
          onClick={() => combobox.openDropdown()}
          onKeyDown={handleKeyDown}
        />
      </Combobox.Target>

      {/* Пока запрос короче трёх символов, подсказки нет вовсе — не пустой
          список, а ничего: искать ещё нечего. */}
      {search.isActive && (
        <Combobox.Dropdown>
          <Combobox.Options>
            <ScrollArea.Autosize mah={DROPDOWN_MAX_HEIGHT_PX} type="scroll">
              {search.isError ? (
                <Combobox.Empty>Не удалось выполнить поиск</Combobox.Empty>
              ) : options.length > 0 ? (
                options
              ) : search.isLoading ? (
                <Combobox.Empty>Идёт поиск…</Combobox.Empty>
              ) : (
                <Combobox.Empty>Ничего не найдено</Combobox.Empty>
              )}
            </ScrollArea.Autosize>
          </Combobox.Options>
        </Combobox.Dropdown>
      )}
    </Combobox>
  );
}
