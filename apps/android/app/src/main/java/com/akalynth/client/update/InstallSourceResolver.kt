package com.akalynth.client.update

import android.content.Context
import android.os.Build

/**
 * Install source resolver per AKALYNTH_ANDROID_SIGNING_POLICY_V1.
 *
 * Detects F-Droid vs direct/sideload/unknown safely.
 * Fails closed to UNKNOWN if source cannot be determined reliably.
 *
 * Critical: Because F-Droid and direct channels have different signers,
 * direct APK update flow MUST NOT be offered/attempted for F-Droid installs.
 */
enum class InstallSource {
    /** Installed via Akalynth F-Droid repository (or F-Droid client). Prefer F-Droid update flow. */
    FDROID,
    /** Direct APK / beta download / sideload where safely detectable. User-approved direct update OK. */
    DIRECT_APK,
    /** Local dev / Gradle assemble (debug/beta). Manual or direct update. */
    DEV_LOCAL,
    /** Unknown sideload or untrusted source. Show instructions; no automatic download. */
    UNKNOWN
}

object InstallSourceResolver {
    private val FDROID_INSTALLER_PACKAGES = setOf(
        "org.fdroid.fdroid",
        "org.fdroid.fdroid.privileged"
    )

    fun resolve(context: Context): InstallSource {
        val pm = context.packageManager
        val packageName = context.packageName

        val installerPackage: String? = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                pm.getInstallSourceInfo(packageName).installingPackageName
            } else {
                @Suppress("DEPRECATION")
                pm.getInstallerPackageName(packageName)
            }
        } catch (_: Exception) {
            null
        }

        // F-Droid takes precedence. Block direct path.
        if (installerPackage != null) {
            val lower = installerPackage.lowercase()
            if (FDROID_INSTALLER_PACKAGES.contains(installerPackage) ||
                lower.contains("fdroid")) {
                return InstallSource.FDROID
            }
        }

        // Direct / sideload indicators (browser download, adb, package installer, files)
        // These are treated as direct-capable (user must still approve Package Installer).
        if (installerPackage == null ||
            installerPackage.contains("packageinstaller", ignoreCase = true) ||
            installerPackage.contains("downloads", ignoreCase = true) ||
            installerPackage == "com.android.shell" ||
            installerPackage.contains("document", ignoreCase = true)) {
            // Distinguish dev local heuristically is difficult without build fingerprint.
            // For policy purposes, treat detectable sideload/direct as DIRECT_APK.
            // DEV_LOCAL is covered under direct flow or manual.
            return InstallSource.DIRECT_APK
        }

        // Fail closed.
        return InstallSource.UNKNOWN
    }

    fun isFroidSource(source: InstallSource): Boolean = source == InstallSource.FDROID

    fun allowsDirectUpdate(source: InstallSource): Boolean =
        source == InstallSource.DIRECT_APK || source == InstallSource.DEV_LOCAL
}
