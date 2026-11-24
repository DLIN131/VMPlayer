package com.vmplayer

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/** 兩個影片來源；外殼依目前來源顯示對應的介面，切換後會記住 */
enum class Source(val label: String) {
    MP("MPlayer"),
    VH("VidHub");

    companion object {
        private const val KEY = "source"

        var current by mutableStateOf(
            runCatching { valueOf(App.prefs.getString(KEY, MP.name)!!) }.getOrDefault(MP),
        )
            private set

        fun select(s: Source) {
            if (s == current) return
            current = s
            App.prefs.edit().putString(KEY, s.name).apply()
        }

        fun toggle() = select(if (current == MP) VH else MP)
    }
}
