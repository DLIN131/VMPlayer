package com.vmplayer.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.vmplayer.Source
import com.vmplayer.UpdateDialog
import com.vmplayer.mp.data.Downloads
import com.vmplayer.mp.data.appScope
import com.vmplayer.mp.net.Account
import com.vmplayer.mp.net.WebFetcher
import com.vmplayer.mp.phone.MpRoot
import com.vmplayer.vh.phone.VhRoot
import kotlinx.coroutines.launch

/** 手機版外殼：依目前來源顯示 MPlayer 或 VidHub 的介面（首頁右上角可切換） */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        Downloads.load()
        // 確認上次的登入還有效（過期就改回本機收藏）
        appScope.launch { Account.refresh() }
        setContent {
            when (Source.current) {
                Source.MP -> MpRoot()
                Source.VH -> VhRoot()
            }
        }
        UpdateDialog.checkOnStart(this)
    }

    // 退到背景時讓隱藏的 WebView 休息
    override fun onStart() {
        super.onStart()
        WebFetcher.resume()
    }

    override fun onStop() {
        super.onStop()
        WebFetcher.pause()
    }
}

/** 首頁標題列上的「切換來源」按鈕（兩個來源的首頁共用） */
@Composable
fun SourceSwitch(color: Color) {
    val other = if (Source.current == Source.MP) Source.VH else Source.MP
    TextButton(onClick = { Source.select(other) }) { Text("⇄ ${other.label}", color = color) }
}
