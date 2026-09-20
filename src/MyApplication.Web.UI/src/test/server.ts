import { setupServer } from "msw/node";

// Единственный MSW-сервер на весь прогон: подменяется сеть, а не наши модули
// (notesApi/apiRequest/хуки работают настоящие). Хендлеры добавляет каждый тест
// через server.use(...), setup.ts сбрасывает их после каждого теста.
export const server = setupServer();
