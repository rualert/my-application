import { useEffect, useRef } from "react";
import { useAuth } from "./AuthProvider";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

// google.accounts.id.initialize() должен вызываться максимум один раз за
// время жизни страницы (повторный вызов — не ошибка по факту, но GIS ругается
// в консоль и переиспользует только последний колбэк) — держим это вне
// React-жизненного цикла компонента, который в StrictMode/при повторном
// логауте-логине монтируется больше одного раза.
let isInitialized = false;
let currentLoginHandler: ((idToken: string) => void) | null = null;

function ensureInitialized() {
  if (isInitialized || !window.google) {
    return;
  }

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => currentLoginHandler?.(response.credential),
  });
  isInitialized = true;
}

/**
 * Кнопка входа через Google Identity Services (accounts.google.com/gsi/client,
 * подключён тегом <script> в index.html). Скрипт грузится асинхронно, поэтому
 * рендер кнопки ждёт его появления на window вместо однократной проверки.
 */
export function GoogleLoginButton() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { login } = useAuth();

  useEffect(() => {
    currentLoginHandler = (idToken) => void login(idToken);
    return () => {
      currentLoginHandler = null;
    };
  }, [login]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;

    function tryRender() {
      if (cancelled) {
        return;
      }

      if (!window.google || !containerRef.current) {
        timeoutId = window.setTimeout(tryRender, 100);
        return;
      }

      ensureInitialized();
      window.google.accounts.id.renderButton(containerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "pill",
        locale: "ru",
      });
    }

    tryRender();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  return <div ref={containerRef} />;
}
