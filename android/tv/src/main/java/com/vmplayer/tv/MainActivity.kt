package com.vmplayer.tv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.runtime.Composable
import androidx.tv.material3.Icon
import androidx.tv.material3.NavigationDrawerItem
import androidx.tv.material3.NavigationDrawerScope
import androidx.tv.material3.Text
import com.vmplayer.Source
import com.vmplayer.UpdateDialog
import com.vmplayer.mp.data.appScope
import com.vmplayer.mp.net.Account
import com.vmplayer.mp.net.WebFetcher
import com.vmplayer.mp.tv.MpTvRoot
import com.vmplayer.vh.tv.VhTvRoot
import kotlinx.coroutines.launch

/** 電視版外殼：依目前來源顯示 MPlayer 或 VidHub 的介面（側邊選單最下面可切換） */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 確認上次的登入還有效（過期就改回本機收藏）
        appScope.launch { Account.refresh() }
        setContent {
            when (Source.current) {
                Source.MP -> MpTvRoot()
                Source.VH -> VhTvRoot()
            }
        }
        UpdateDialog.checkOnStart(this)
    }

    // 播放影片或退到背景時讓隱藏的 WebView 休息，CPU 和記憶體留給播放器
    override fun onStart() {
        super.onStart()
        WebFetcher.resume()
    }

    override fun onStop() {
        super.onStop()
        WebFetcher.pause()
    }
}

/** 側邊選單最下面的「切換來源」（兩個來源共用） */
@Composable
fun NavigationDrawerScope.SourceDrawerItem() {
    val other = if (Source.current == Source.MP) Source.VH else Source.MP
    NavigationDrawerItem(
        selected = false,
        onClick = { Source.select(other) },
        leadingContent = { Icon(Icons.Filled.Refresh, contentDescription = null) },
    ) { Text("切換到 ${other.label}") }
}
