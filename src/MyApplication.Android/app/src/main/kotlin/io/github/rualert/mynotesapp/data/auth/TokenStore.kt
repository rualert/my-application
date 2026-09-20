package io.github.rualert.mynotesapp.data.auth

/**
 * Access-token живёт только в памяти процесса — на диск он не попадает, как и
 * в веб-интерфейсе (там это модульная переменная, а не localStorage). Пережить
 * перезапуск приложения ему и не нужно: сессия восстанавливается по
 * refresh-cookie, см. [AuthRepository.restoreSession].
 */
class TokenStore {

    @Volatile
    var accessToken: String? = null
}
