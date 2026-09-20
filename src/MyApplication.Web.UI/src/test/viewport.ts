// Ширины экрана в jsdom нет вовсе, как и matchMedia, — поэтому её задаёт сам тест,
// а заглушка matchMedia отвечает на медиазапросы по ней. По умолчанию экран широкий:
// «обычный» интерфейс — тот, что для ПК.
const DESKTOP_WIDTH_PX = 1280;
const MOBILE_WIDTH_PX = 390;
const MAX_WIDTH_QUERY = /\(max-width:\s*([\d.]+)(em|px)\)/;
const EM_IN_PX = 16;

let widthPx = DESKTOP_WIDTH_PX;

function matches(query: string) {
  // Отвечаем только на запросы про ширину: остальные (например, prefers-color-scheme,
  // который смотрит сама Mantine) ширина экрана не касается.
  const parsed = MAX_WIDTH_QUERY.exec(query);
  if (!parsed) {
    return false;
  }
  const maxWidthPx = parsed[2] === "em" ? Number(parsed[1]) * EM_IN_PX : Number(parsed[1]);
  return widthPx <= maxWidthPx;
}

export function installMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: matches(query),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

/** Показать интерфейс для телефона. Вызывается до render: ширину читают при первом рендере. */
export function setMobileViewport() {
  widthPx = MOBILE_WIDTH_PX;
}

export function resetViewport() {
  widthPx = DESKTOP_WIDTH_PX;
}
