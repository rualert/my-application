package io.github.rualert.mynotesapp.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [NoteEntity::class], version = 1, exportSchema = false)
abstract class NotesDatabase : RoomDatabase() {

    abstract fun notesDao(): NotesDao

    companion object {
        fun create(context: Context): NotesDatabase =
            Room.databaseBuilder(context.applicationContext, NotesDatabase::class.java, "notes.db")
                .build()
    }
}
