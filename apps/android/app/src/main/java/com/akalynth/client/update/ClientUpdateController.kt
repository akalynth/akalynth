package com.akalynth.client.update

import android.content.Context
import com.akalynth.client.BuildConfig
import com.akalynth.client.network.ClientUpdateApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.security.MessageDigest

sealed class ClientUpdateState {
    data object Idle : ClientUpdateState()
    data object Skipped : ClientUpdateState()
    data object Checking : ClientUpdateState()
    data object UpToDate : ClientUpdateState()
    data class Downloading(val progressPercent: Int, val versionName: String) : ClientUpdateState()
    data class ReadyToInstall(val versionName: String) : ClientUpdateState()
    /** APK is ready but the OS blocked install until the player grants unknown-app permission. */
    data class NeedsInstallPermission(val versionName: String) : ClientUpdateState()
    data class Failed(val message: String) : ClientUpdateState()
}

/**
 * Beta/staging self-update: on every app start (and resume after permission settings),
 * fetch the lane update manifest, download a newer APK if present, verify SHA-256, install.
 */
class ClientUpdateController(
    private val context: Context,
    private val api: ClientUpdateApi = ClientUpdateApi(),
    private val downloadClient: OkHttpClient = OkHttpClient()
) {
    private val _state = MutableStateFlow<ClientUpdateState>(ClientUpdateState.Idle)
    val state: StateFlow<ClientUpdateState> = _state.asStateFlow()

    private val checkMutex = Mutex()
    private var pendingApk: File? = null
    private var pendingVersionName: String? = null

    val blocksLogin: Boolean
        get() = when (_state.value) {
            is ClientUpdateState.Checking,
            is ClientUpdateState.Downloading,
            is ClientUpdateState.ReadyToInstall,
            is ClientUpdateState.NeedsInstallPermission -> true
            else -> false
        }

    /**
     * Safe to call on every cold start and every resume.
     * Concurrent calls coalesce; in-flight download is not restarted.
     */
    suspend fun checkAndUpdate() {
        if (BuildConfig.BUILD_TYPE != "beta" && BuildConfig.BUILD_TYPE != "staging") {
            _state.value = ClientUpdateState.Skipped
            return
        }

        // Already downloading / about to install — do not re-enter.
        when (val current = _state.value) {
            is ClientUpdateState.Downloading,
            is ClientUpdateState.ReadyToInstall -> return
            is ClientUpdateState.NeedsInstallPermission -> {
                // Player may have granted permission in Settings; resume install.
                resumePendingInstall()
                return
            }
            else -> Unit
        }

        if (!checkMutex.tryLock()) return
        try {
            _state.value = ClientUpdateState.Checking
            val manifest = withContext(Dispatchers.IO) { api.fetchManifest() }
            if (manifest == null) {
                // Manifest missing or network blip: do not block play.
                _state.value = ClientUpdateState.UpToDate
                return
            }

            val installedCode = BuildConfig.VERSION_CODE
            if (manifest.versionCode <= installedCode) {
                pendingApk = null
                pendingVersionName = null
                _state.value = ClientUpdateState.UpToDate
                return
            }

            val apkFile = downloadApk(manifest) ?: return
            if (!verifySha256(apkFile, manifest.apkSha256)) {
                apkFile.delete()
                pendingApk = null
                pendingVersionName = null
                _state.value = ClientUpdateState.Failed("Download checksum mismatch")
                return
            }

            pendingApk = apkFile
            pendingVersionName = manifest.versionName
            launchInstall(apkFile, manifest.versionName)
        } finally {
            checkMutex.unlock()
        }
    }

    fun openInstallPermissionSettings() {
        ApkInstaller.openInstallPermissionSettings(context)
    }

    private suspend fun resumePendingInstall() {
        val apk = pendingApk
        val name = pendingVersionName
        if (apk == null || name == null || !apk.exists()) {
            _state.value = ClientUpdateState.Failed("Update file missing; will retry next launch")
            return
        }
        launchInstall(apk, name)
    }

    private suspend fun launchInstall(apkFile: File, versionName: String) {
        if (!ApkInstaller.canInstallPackages(context)) {
            _state.value = ClientUpdateState.NeedsInstallPermission(versionName)
            return
        }
        _state.value = ClientUpdateState.ReadyToInstall(versionName)
        withContext(Dispatchers.Main) {
            ApkInstaller.install(context, apkFile)
        }
    }

    private suspend fun downloadApk(manifest: ClientUpdateApi.UpdateManifest): File? {
        val updatesDir = File(context.cacheDir, "updates").apply { mkdirs() }
        val apkFile = File(updatesDir, "akalynth-${manifest.lane}-${manifest.versionCode}.apk")
        if (apkFile.exists() && verifySha256(apkFile, manifest.apkSha256)) {
            return apkFile
        }
        apkFile.delete()

        return withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder().url(manifest.apkUrl).build()
                downloadClient.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) {
                        _state.value = ClientUpdateState.Failed("Download failed (HTTP ${response.code})")
                        return@withContext null
                    }
                    val body = response.body ?: run {
                        _state.value = ClientUpdateState.Failed("Download failed (empty body)")
                        return@withContext null
                    }
                    val totalBytes = when {
                        body.contentLength() > 0 -> body.contentLength()
                        manifest.sizeBytes > 0 -> manifest.sizeBytes
                        else -> -1L
                    }
                    body.byteStream().use { input ->
                        apkFile.outputStream().use { output ->
                            val buffer = ByteArray(8192)
                            var downloaded = 0L
                            while (true) {
                                val read = input.read(buffer)
                                if (read <= 0) break
                                output.write(buffer, 0, read)
                                downloaded += read
                                if (totalBytes > 0) {
                                    val percent = ((downloaded * 100) / totalBytes).toInt().coerceIn(0, 100)
                                    _state.value = ClientUpdateState.Downloading(percent, manifest.versionName)
                                } else {
                                    _state.value = ClientUpdateState.Downloading(0, manifest.versionName)
                                }
                            }
                        }
                    }
                }
                apkFile
            } catch (e: Exception) {
                _state.value = ClientUpdateState.Failed("Download failed: ${e.message ?: "unknown"}")
                null
            }
        }
    }

    private fun verifySha256(file: File, expected: String): Boolean {
        if (!Regex("^[a-f0-9]{64}$").matches(expected)) return false
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(8192)
            while (true) {
                val read = input.read(buffer)
                if (read <= 0) break
                digest.update(buffer, 0, read)
            }
        }
        val actual = digest.digest().joinToString("") { "%02x".format(it) }
        return actual == expected
    }
}
