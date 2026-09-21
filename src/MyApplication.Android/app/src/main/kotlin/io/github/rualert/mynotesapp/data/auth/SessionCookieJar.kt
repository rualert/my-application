package io.github.rualert.mynotesapp.data.auth

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import java.util.concurrent.ConcurrentHashMap

/**
 * Cookie-хранилище HTTP-клиента. Нужно ради одной cookie — `refresh_token`,
 * которую сервер ставит на `/Auth` (см. docs/docs/auth/api-contract): браузер
 * держал бы её сам, нативному клиенту приходится делать это своими руками.
 *
 * Атрибут `SameSite` здесь ни на что не влияет — это правило браузера о
 * межсайтовых запросах, а не требование к клиенту; `Secure` соблюдается самим
 * OkHttp через [Cookie.matches].
 *
 * Записи переживают перезапуск: [restore] поднимает их из [CookieStorage], а
 * каждый ответ сервера сохраняется туда заново.
 */
class SessionCookieJar(
    private val storage: CookieStorage,
    private val baseUrl: HttpUrl,
    private val scope: CoroutineScope,
) : CookieJar {

    private val cookies = ConcurrentHashMap<String, Cookie>()

    /**
     * Поднимает сохранённые cookie при старте приложения.
     *
     * @return была ли восстановлена хоть одна живая cookie. По этому признаку
     * видно, есть ли вообще что обменивать на сессию: на свежей установке
     * обращаться к серверу незачем.
     */
    suspend fun restore(): Boolean {
        val restored = storage.read()
            .mapNotNull { saved -> Cookie.parse(baseUrl, saved) }
            .filter { cookie -> !cookie.isExpired() }

        restored.forEach { cookie -> cookies[cookie.name] = cookie }
        return restored.isNotEmpty()
    }

    suspend fun clear() {
        cookies.clear()
        storage.clear()
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        dropExpired()
        return cookies.values.filter { cookie -> cookie.matches(url) }
    }

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        cookies.forEach { cookie ->
            // Сервер удаляет cookie, выставляя её просроченной, — такую не храним.
            if (cookie.isExpired()) {
                this.cookies.remove(cookie.name)
            } else {
                this.cookies[cookie.name] = cookie
            }
        }
        persist()
    }

    private fun dropExpired() {
        val expired = cookies.values.filter { cookie -> cookie.isExpired() }
        if (expired.isEmpty()) {
            return
        }

        expired.forEach { cookie -> cookies.remove(cookie.name) }
        persist()
    }

    private fun persist() {
        val snapshot = cookies.values.map { cookie -> cookie.toString() }.toSet()
        scope.launch { storage.write(snapshot) }
    }

    private fun Cookie.isExpired(): Boolean = expiresAt <= System.currentTimeMillis()
}
