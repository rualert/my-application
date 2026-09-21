package io.github.rualert.mynotesapp

import android.app.Application
import android.content.Context

class MyNotesApplication : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}

/** Достаёт граф зависимостей из любого контекста — в том числе из Compose. */
val Context.appContainer: AppContainer
    get() = (applicationContext as MyNotesApplication).container
