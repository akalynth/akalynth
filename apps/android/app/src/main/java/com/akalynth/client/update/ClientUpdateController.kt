package com.akalynth.client.update

import android.content.Context
import com.akalynth.client.BuildConfig
import com.akalynth.client.network.ClientUpdateApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
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
    data class Failed(val message: String) : ClientUpdateState()
    // New states for install-source-aware policy branching (AKALYNTH_ANDROID_SIGNING_POLICY_V1)
    /** F-Droid source detected: route to F-Droid flow. Do not offer direct APK. */
    data object FdroidPreferred : ClientUpdateState()
    /** Unknown or untrusted install source: show instructions; no auto download. */
    data class ChannelGuidance(val guidance: String) : ClientUpdateState()
}

class ClientUpdateController(
    private val context: Context,
    private val api: ClientUpdateApi = ClientUpdateApi(),
    private val downloadClient: OkHttpClient = OkHttpClient()
) {
    private val _state = MutableStateFlow<ClientUpdateState>(ClientUpdateState.Idle)
    val state: StateFlow<ClientUpdateState> = _state.asStateFlow()

    val blocksLogin: Boolean
        get() = _state.value is ClientUpdateState.Checking ||
            _state.value is ClientUpdateState.Downloading ||
            _state.value is ClientUpdateState.ReadyToInstall
        // FdroidPreferred and ChannelGuidance do not block login (policy UX: advise but allow use).

    suspend fun checkAndUpdate() {
        if (BuildConfig.BUILD_TYPE != "beta" && BuildConfig.BUILD_TYPE != "staging") {
            _state.value = ClientUpdateState.Skipped
            return
        }

        // 1. Resolve install source (required by signing policy)
        val source = InstallSourceResolver.resolve(context)

        _state.value = ClientUpdateState.Checking
        val manifest = withContext(Dispatchers.IO) { api.fetchManifest() }
        if (manifest == null) {
            _state.value = ClientUpdateState.UpToDate
            return
        }

        // 2. Safety checks (package, version)
        if (context.packageName != "com.akalynth.client") {
            _state.value = ClientUpdateState.Failed("Package name mismatch (expected com.akalynth.client)")
            return
        }

        val installedCode = BuildConfig.VERSION_CODE
        if (manifest.versionCode <= installedCode) {
            _state.value = ClientUpdateState.UpToDate
            return
        }

        // 3. Policy branching on install source (CRITICAL: respect signer mismatch)
        when (source) {
            InstallSource.FDROID -> {
                // F-Droid installs: never promise or attempt direct APK update.
                // Route to F-Droid update flow or guidance. Do not download.
                _state.value = ClientUpdateState.FdroidPreferred
                return
            }
            InstallSource.UNKNOWN -> {
                // Unknown sideload: show canonical instructions. No automatic download.
                _state.value = ClientUpdateState.ChannelGuidance(
                    "Update source unknown or untrusted. " +
                    "For Akalynth via F-Droid, use the F-Droid app. " +
                    "For direct installs of Akalynth Beta visit beta.akalynth.com or use the provided APK URL. " +
                    "No automatic update offered."
                )
                return
            }
            InstallSource.DIRECT_APK, InstallSource.DEV_LOCAL -> {
                // Direct / dev: proceed with user-approved download + Package Installer prompt only.
                // SHA + version already checked above.
                val apkFile = downloadApk(manifest) ?: return
                if (!verifySha256(apkFile, manifest.apkSha256)) {
                    apkFile.delete()
                    _state.value = ClientUpdateState.Failed("Download checksum mismatch")
                    return
                }

                _state.value = ClientUpdateState.ReadyToInstall(manifest.versionName)
                withContext(Dispatchers.Main) {
                    ApkInstaller.install(context, apkFile)
                }
            }
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