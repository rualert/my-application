import { useMediaQuery } from "@mantine/hooks";

// Порог — брейкпоинт `sm` Mantine (768px): уже него список заметок и редактор рядом
// не помещаются (docs/docs/notes/web-ui.md, «Интерфейс для телефона»).
export const MOBILE_MEDIA_QUERY = "(max-width: 48em)";

/**
 * Показывать ли интерфейс для телефона. Нужен там, где от ширины зависит само
 * поведение (какой экран показан, куда ведёт кнопка); там, где меняется только
 * видимость, хватает свойств Mantine `visibleFrom`/`hiddenFrom`, без JS.
 *
 * Ширину читаем сразу при первом рендере, а не эффектом: иначе на телефоне на
 * мгновение показалась бы раскладка для ПК.
 */
export function useIsMobile() {
  return useMediaQuery(MOBILE_MEDIA_QUERY, undefined, { getInitialValueInEffect: false });
}
