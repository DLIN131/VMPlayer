package com.vmplayer

import android.app.Application
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import com.google.android.gms.net.CronetProviderInstaller

/** 手機版和電視版共用的 Application：兩個來源的初始化，以及封面的圖片快取 */
class App : Application(), ImageLoaderFactory {
    companion object {
        lateinit var instance: App
            private set

        /** 電視版（盒子效能和記憶體都比較吃緊） */
        val isTv: Boolean by lazy {
            instance.packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK) || instance.packageName.endsWith(".tv")
        }

        /** 外殼自己的設定（目前來源、略過的更新版本） */
        val prefs: SharedPreferences by lazy { instance.getSharedPreferences("vmplayer", Context.MODE_PRIVATE) }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        // 先在背景準備好 Google Play 服務的 Cronet，第一次播放時就能用（見 mp.data.VideoSource）
        runCatching { CronetProviderInstaller.installProvider(this) }
        com.vmplayer.vh.Site.init(this)
        com.vmplayer.vh.Store.init(this)
        com.vmplayer.vh.Downloads.init(this)
    }

    override fun newImageLoader(): ImageLoader = ImageLoader.Builder(this)
        .okHttpClient { com.vmplayer.vh.Api.http }
        // 電視上卡片一次很多張，淡入動畫和 ARGB 圖片都很吃效能／記憶體
        .crossfade(!isTv)
        .allowRgb565(isTv)
        .memoryCache { MemoryCache.Builder(this).maxSizePercent(if (isTv) 0.15 else 0.25).build() }
        .diskCache {
            DiskCache.Builder()
                .directory(cacheDir.resolve("images"))
                .maxSizeBytes(256L * 1024 * 1024)
                .build()
        }
        .build()
}
