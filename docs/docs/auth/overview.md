---
sidebar_position: 1
title: Обзор сценария
---

# Авторизация — обзор

## Что это

Вход в приложение через Google (без собственных логина/пароля). После
успешного входа приложение выдаёт собственные JWT-токены (access + refresh),
которыми фронтенд подтверждает каждый последующий запрос — Google дальше в
процессе не участвует. Заметки (см. [«Заметки»](/notes/overview)) приватны:
каждая принадлежит выдавшему их пользователю.

## Поток входа

1. Клиент получает Google ID token через Google Identity Services (на вебе —
   стандартная кнопка «Войти через аккаунт Google»).
2. `POST /Auth/google` с этим токеном — сервер проверяет его подпись/audience
   у Google, находит пользователя по идентификатору его профиля Google
   (`GoogleSubjectId`) либо создаёт нового — и заводит ему приветственную
   заметку (см. [правила](./business-rules)) — выдаёт пару токенов.
3. Access token возвращается в теле ответа и живёт недолго (по умолчанию
   15 минут, см. [правила](./business-rules)). Refresh token живёт в
   httpOnly cookie — клиентский JS его не видит.
4. `POST /Auth/refresh` по этой cookie выдаёт новую пару токенов, отзывая
   старый refresh token (ротация). Клиент вызывает его, когда access token
   истёк, и один раз при открытии приложения — чтобы обновление страницы не
   разлогинивало пользователя.
5. `POST /Auth/logout` отзывает refresh token и удаляет cookie.

## Где реализовано

| Слой | Компонент | Ответственность |
|---|---|---|
| Domain | `User` | Пользователь, аутентифицированный через Google |
| Domain | `RefreshToken` | Refresh-токен с сроком действия и возможностью отзыва |
| Domain | `UserValidationException` | Нарушение инвариантов пользователя |
| Application | `IAuthService` / `AuthService` | Use case'ы: войти через Google, обновить сессию, выйти |
| Application | `IUserRepository`, `IRefreshTokenRepository` | Порты для хранения пользователей и refresh-токенов |
| Application | `IGoogleIdTokenValidator` | Порт проверки Google ID token (единственная внешняя интеграция) |
| Application | `IJwtTokenGenerator` | Порт выпуска собственных access token'ов |
| Application | `IUserRegistrationHandler` | Порт реакции на регистрацию нового пользователя; реализует фича «Заметки» (`WelcomeNoteRegistrationHandler` — приветственная заметка) |
| Application | `InvalidGoogleTokenException`, `InvalidRefreshTokenException` | Ошибки аутентификации (401, см. [контракт API](./api-contract)) |
| Infrastructure | `AuthDbContext`, `UserRepository`, `RefreshTokenRepository` | Хранение через EF Core + PostgreSQL |
| Infrastructure | `GoogleIdTokenValidator` | Проверка токена через `Google.Apis.Auth` |
| Infrastructure | `JwtTokenGenerator` | Подпись access token'ов (HMAC-SHA256) |
| Api (Presentation) | `AuthController` | REST-эндпоинты, см. [контракт API](./api-contract) |
| Api (Presentation) | `NotesController` | Требует валидный access token (`[Authorize]`), связывает заметки с вызывающим пользователем |
| Web (Presentation) | `MyApplication.Web.UI` | Кнопка входа и хранение сессии, см. [интерфейс](/notes/web-ui) |

## Дальше

- [Правила выдачи и жизни токенов](./business-rules)
- [Контракт API](./api-contract)
