import { Group, Kbd, Modal, Stack, Text } from "@mantine/core";
import { Fragment, useState } from "react";
import { useHotkey } from "../hooks/useHotkey";

interface HotkeyRow {
  keys: string[];
  action: string;
  // Клавиши нажимают одну за другой (двойной Shift, стрелки), а не вместе.
  sequence?: boolean;
}

// Тот же список, что в docs/docs/notes/web-ui.md, «Горячие клавиши», и в приветственной
// заметке (WelcomeNote.cs): меняя сочетание, поправьте все три.
const GROUPS: { title: string; rows: HotkeyRow[] }[] = [
  {
    title: "Из любого места",
    rows: [
      { keys: ["Shift", "Shift"], action: "Курсор в поле поиска", sequence: true },
      { keys: ["Alt", "N"], action: "Создать заметку" },
      { keys: ["Ctrl", "E"], action: "Режим просмотра или редактирования" },
      { keys: ["Ctrl", "\\"], action: "Свернуть или развернуть список" },
      { keys: ["Ctrl", "/"], action: "Это окно" },
    ],
  },
  {
    title: "В списке заметок",
    rows: [
      { keys: ["↑", "↓"], action: "Предыдущая или следующая заметка", sequence: true },
      { keys: ["Enter"], action: "Курсор в текст заметки" },
      { keys: ["Delete"], action: "Удалить заметку" },
    ],
  },
  {
    title: "В заметке",
    // Переход между заголовком и текстом (Enter, ↑, ↓) здесь намеренно не назван:
    // заголовок ведёт себя как первая строка текста, и это понятно без подсказки.
    rows: [{ keys: ["Esc"], action: "Вернуться в список" }],
  },
  {
    title: "В поиске",
    rows: [
      { keys: ["↑", "↓"], action: "Перемещение по результатам", sequence: true },
      { keys: ["Enter"], action: "Открыть заметку, повторный — начать её редактировать" },
      { keys: ["Esc"], action: "Очистить запрос, повторный — выйти из поиска" },
    ],
  },
];

/**
 * Окно со списком горячих клавиш, открывается по Ctrl + / (docs/docs/notes/web-ui.md,
 * «Горячие клавиши»). Сами сочетания живут в тех компонентах, которых они касаются, —
 * здесь только их перечень для пользователя.
 */
export function HotkeysHelp() {
  const [opened, setOpened] = useState(false);

  useHotkey({ code: "Slash", mod: true }, () => setOpened((value) => !value));

  return (
    <Modal opened={opened} onClose={() => setOpened(false)} title="Горячие клавиши" centered>
      <Stack gap="lg">
        {GROUPS.map((group) => (
          <Stack key={group.title} gap="xs">
            <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
              {group.title}
            </Text>
            {group.rows.map((row) => (
              <Group key={row.action} justify="space-between" wrap="nowrap" gap="md" align="flex-start">
                <Text size="sm">{row.action}</Text>
                <Group gap={4} wrap="nowrap">
                  {row.keys.map((key, index) => (
                    <Fragment key={`${key}-${index}`}>
                      {index > 0 && !row.sequence && (
                        <Text size="sm" c="dimmed">
                          +
                        </Text>
                      )}
                      <Kbd>{key}</Kbd>
                    </Fragment>
                  ))}
                </Group>
              </Group>
            ))}
          </Stack>
        ))}
        <Text size="xs" c="dimmed">
          На Mac вместо Ctrl — Cmd. Сочетания определяются по положению клавиши, поэтому работают в любой
          раскладке.
        </Text>
      </Stack>
    </Modal>
  );
}
