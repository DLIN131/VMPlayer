package com.vmplayer.vh.phone

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color

/** VidHub 來源的整個介面（外殼 MainActivity 依目前來源顯示） */
@Composable
fun VhRoot() {
    AppTheme {
        val holder = rememberSaveableStateHolder()
        BackHandler(enabled = Nav.stack.size > 1) { Nav.pop() }
        // 主畫面不在首頁分頁時，返回鍵先回首頁
        BackHandler(enabled = Nav.stack.size == 1 && MainState.tab != 0) { MainState.tab = 0 }
        val route = Nav.top
        // 播放器全螢幕，其他畫面避開狀態列和導覽列
        val mod = if (route is Route.Player) Modifier.fillMaxSize().background(Color.Black)
        else Modifier.fillMaxSize().background(Background).safeDrawingPadding()
        Box(mod) {
            holder.SaveableStateProvider(route.key) {
                when (route) {
                    Route.Main -> MainScreen()
                    is Route.Tag -> TagScreen(route)
                    is Route.SeriesList -> SeriesListScreen(route)
                    is Route.Search -> SearchScreen(route)
                    is Route.VideoPage -> VideoScreen(route)
                    is Route.ShowPage -> ShowScreen(route)
                    is Route.Player -> PlayerScreen(route)
                }
            }
        }
    }
}
