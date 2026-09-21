package io.github.rualert.mynotesapp.ui.auth

import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import io.github.rualert.mynotesapp.data.auth.CookieStorage
import io.github.rualert.mynotesapp.data.auth.SessionState
import io.github.rualert.mynotesapp.ui.notes.NotesViewModel
import io.github.rualert.mynotesapp.ui.notes.harness.NotesTestBackend
import io.github.rualert.mynotesapp.ui.notes.harness.awaitCondition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.isActive
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment

/**
 * Конец сессии — docs/docs/notes/android.md, «Вход и сессия»: после выхода
 * загруженные заметки забываются. Иначе следующий вошедший увидел бы чужие
 * заметки, а неотправленные правки прошлого пользователя уехали бы на сервер
 * под его учётной записью.
 */
@RunWith(RobolectricTestRunner::class)
class SessionEndTest {

    private val dispatcher = StandardTestDispatcher()

    private lateinit var backend: NotesTestBackend
    private lateinit var Sut: AuthViewModel

    @Before
    fun setUp() {
        // Та же схема, что в NotesViewModelTestBase: корутины ViewModel идут
        // сразу, время остаётся виртуальным.
        Dispatchers.setMain(UnconfinedTestDispatcher(dispatcher.scheduler))
        backend = NotesTestBackend()
        // Системный диалог Google — внешняя зависимость, её и подменяем.
        Sut = AuthViewModel(backend.authRepository, requestGoogleIdToken = { GOOGLE_ID_TOKEN })
    }

    @After
    fun tearDown() {
        // ViewModel заметок наблюдают за базой — остановить их до того, как
        // она закроется.
        Sut.sessionViewModels.viewModelStore.clear()
        Sut.viewModelScope.cancel()
        // Cookie сессии лежит на диске и пережила бы тест: следующий тогда
        // начинался бы уже вошедшим.
        runBlocking { CookieStorage(RuntimeEnvironment.getApplication()).clear() }
        backend.close()
        Dispatchers.resetMain()
    }

    @Test
    fun `выход забывает заметки на устройстве — и отправленные, и нет`() = runTest(dispatcher) {
        // Arrange
        signIn()
        val sent = backend.addNote("Уже на сервере", "Текст")
        val notes = notesViewModel()
        notes.refresh()
        awaitCondition("заметка с сервера приехала на устройство") { backend.localIdOf(sent) != null }
        backend.goOffline()
        notes.createNote()
        awaitCondition("заметка создана без сети") { backend.pendingCount() == 1 }
        backend.goOnline()

        // Act
        Sut.logout()
        awaitCondition("заметки забыты") { backend.localNoteCount() == 0 }

        // Assert
        assertEquals(SessionState.LoggedOut, Sut.session.value)
        assertEquals(0, backend.localNoteCount())
    }

    @Test
    fun `сессия, которую сервер не продлил, тоже забывает заметки`() = runTest(dispatcher) {
        // Arrange
        signIn()
        val sent = backend.addNote("Уже на сервере", "Текст")
        notesViewModel().refresh()
        awaitCondition("заметка с сервера приехала на устройство") { backend.localIdOf(sent) != null }
        backend.expireSession()

        // Act
        // Так сессию продлевает любой запрос, получивший 401.
        backend.authRepository.refreshSession(staleToken = NotesTestBackend.ACCESS_TOKEN)
        awaitCondition("заметки забыты") { backend.localNoteCount() == 0 }

        // Assert
        assertEquals(SessionState.LoggedOut, Sut.session.value)
        assertEquals(0, backend.localNoteCount())
    }

    @Test
    fun `после выхода экран заметок начинается с чистого листа`() = runTest(dispatcher) {
        // Arrange
        signIn()
        val previous = notesViewModel()
        previous.createNote()
        awaitCondition("заметка открыта") { previous.editor.value.noteId != null }
        previous.onTextChange("Черновик прошлого пользователя")

        // Act
        Sut.logout()
        awaitCondition("вышли") { Sut.session.value == SessionState.LoggedOut }
        signIn()
        val next = notesViewModel()

        // Assert
        assertNotSame(previous, next)
        assertFalse("ViewModel прошлой сессии остановлена", previous.viewModelScope.isActive)
        assertNull(next.editor.value.noteId)
    }

    private suspend fun TestScope.signIn() {
        // Восстановление сессии при создании ViewModel идёт само по себе, и
        // его «не вошёл» могло бы лечь поверх только что выполненного входа.
        awaitCondition("сессия восстановлена") { Sut.session.value != SessionState.Restoring }
        Sut.signIn(RuntimeEnvironment.getApplication())
        awaitCondition("вошли") { Sut.session.value is SessionState.LoggedIn }
    }

    /** ViewModel заметок — оттуда же, откуда её берёт экран. */
    private fun notesViewModel(): NotesViewModel = ViewModelProvider(
        Sut.sessionViewModels,
        viewModelFactory { initializer { NotesViewModel(backend.repository) } },
    )[NotesViewModel::class.java]

    private companion object {
        const val GOOGLE_ID_TOKEN = "google-id-token"
    }
}
