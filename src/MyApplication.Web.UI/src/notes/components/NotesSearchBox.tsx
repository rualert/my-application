import { Combobox, Loader, ScrollArea, Stack, Text, TextInput, useCombobox } from "@mantine/core";
import { Search } from "lucide-react";
import { useState } from "react";
import type { KeyboardEvent } from "react";
import { UNTITLED_TITLE } from "../domain";
import { useNotesSearch } from "../hooks/useNotesSearch";
import { HighlightedText } from "./HighlightedText";

const DROPDOWN_MAX_HEIGHT_PX = 320;

interface NotesSearchBoxProps {
  onSelect: (id: string) => void;
}

/**
 * Поле поиска по заметкам в шапке приложения: от трёх символов показывает
 * выпадающий список найденного (заголовок и фрагмент текста с подсвеченными
 * совпадениями), нажатие на строку открывает соответствующую заметку.
 */
export function NotesSearchBox({ onSelect }: NotesSearchBoxProps) {
  const [query, setQuery] = useState("");
  const search = useNotesSearch(query);
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });

  const handleSubmit = (id: string) => {
    onSelect(id);
    combobox.closeDropdown();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setQuery("");
      combobox.closeDropdown();
    }
  };

  const options = search.results.map((result) => (
    <Combobox.Option value={result.id} key={result.id}>
      <Stack gap={2}>
        <Text size="sm" fw={500} c={result.title.length === 0 ? "dimmed" : undefined}>
          {result.title.length === 0 ? UNTITLED_TITLE : <HighlightedText segments={result.title} />}
        </Text>
        <Text size="xs" c="dimmed" lineClamp={2}>
          <HighlightedText segments={result.snippet} />
        </Text>
      </Stack>
    </Combobox.Option>
  ));

  return (
    <Combobox store={combobox} onOptionSubmit={handleSubmit}>
      <Combobox.Target>
        <TextInput
          aria-label="Поиск по заметкам"
          placeholder="Поиск по заметкам"
          leftSection={<Search size={16} />}
          rightSection={search.isLoading ? <Loader size="xs" /> : null}
          value={query}
          w="100%"
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            combobox.openDropdown();
            combobox.resetSelectedOption();
          }}
          onFocus={() => combobox.openDropdown()}
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
