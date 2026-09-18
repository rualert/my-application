---
sidebar_position: 3
title: Контракт API
---

# Контракт API

Реализовано в `AuthController` (`src/MyApplication/MyApplication.Api/Controllers/AuthController.cs`).

## Эндпоинты

| Метод и путь | Описание | Успех | Ошибки |
|---|---|---|---|
| `POST /Auth/google` | Войти по Google ID token | `200 OK` + access token, ставит refresh-cookie | `401` — невалидный токен Google |
| `POST /Auth/refresh` | Обновить сессию по refresh-cookie (ротация) | `200 OK` + новый access token, перевыставляет cookie | `401` — cookie отсутствует/просрочена/уже отозвана |
| `POST /Auth/logout` | Завершить сессию, отозвать refresh token | `204 No Content` (идемпотентно) | — |

Ни один из эндпоинтов `/Auth/*` не требует `Authorization`-заголовка — это
сама точка входа в сессию.

## Refresh-cookie

Ставится `POST /Auth/google` и `POST /Auth/refresh`, удаляется
`POST /Auth/logout`:

| Атрибут | Значение |
|---|---|
| Имя | `refresh_token` |
| `HttpOnly` | да — недоступна клиентскому JS |
| `Secure` | да вне Development-окружения |
| `SameSite` | `Strict` |
| `Path` | `/Auth` — не отправляется на `/Notes` и другие эндпоинты |

## Тело запроса

`POST /Auth/google`:

```json
{
  "idToken": "<Google ID token>"
}
```

`POST /Auth/refresh` и `POST /Auth/logout` тела не принимают — refresh token
берётся из cookie.

## Тело ответа

`POST /Auth/google`, `POST /Auth/refresh`:

```json
{
  "accessToken": "<JWT>",
  "expiresAt": "2026-09-18T12:00:00Z"
}
```

## Защищённые эндпоинты

`/Notes/*` (см. [контракт API заметок](/notes/api-contract)) требуют
заголовок `Authorization: Bearer <accessToken>`. Его отсутствие или
невалидность даёт `401`; валидный токен, но обращение к чужой заметке — `403`.
