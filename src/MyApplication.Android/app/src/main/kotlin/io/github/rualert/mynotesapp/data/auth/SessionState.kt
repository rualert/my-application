package io.github.rualert.mynotesapp.data.auth

/** Состояние сессии, от которого зависит, какой экран показан. */
sealed interface SessionState {

    /** Приложение только запустилось и пробует восстановить прошлую сессию. */
    data object Restoring : SessionState

    /** Пользователь не вошёл: показан экран входа. */
    data object LoggedOut : SessionState

    /**
     * Сессия, возможно, жива, но сервер недоступен: сеть отвалилась или отвечает
     * ошибкой. Отличается от [LoggedOut] намеренно — сохранённый refresh-token
     * при этом не выбрасывается, и после «Повторить» пользователь продолжает
     * работать, а не входит заново.
     */
    data object Unavailable : SessionState

    /** Пользователь вошёл; [userName] показывается в интерфейсе. */
    data class LoggedIn(val userName: String) : SessionState
}
