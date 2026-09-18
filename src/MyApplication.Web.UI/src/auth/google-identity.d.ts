// Минимальные типы под vanilla Google Identity Services (accounts.google.com/gsi/client,
// подключается тегом <script> в index.html — обёртки вроде @react-oauth/google не используются).
export {};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }): void;
          renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
        };
      };
    };
  }
}
