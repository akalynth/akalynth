package com.akalynth.client.protocol

/**
 * Client-side view of the Akalynth WebSocket protocol contract.
 *
 * [PROTOCOL_VERSION] MUST track `PROTOCOL_VERSION` in `packages/shared/protocol.ts`. The server
 * announces its version in the `welcome` frame; the client compares it on connect and surfaces a
 * clear mismatch instead of silently proceeding (see [versionCompatibility]).
 */
object Protocol {
    /** Mirror of protocol.ts `PROTOCOL_VERSION`. */
    const val PROTOCOL_VERSION: String = "2.1.0"

    enum class VersionCompatibility {
        /** Exact match. */
        MATCH,

        /** Same major version, differing minor/patch — tolerated but worth noting. */
        MINOR_MISMATCH,

        /** Different major version (or unparseable) — incompatible, surface to the user. */
        INCOMPATIBLE
    }

    /**
     * Compare the server's announced version against [PROTOCOL_VERSION].
     *
     * Semantic-version aware: only the major component gates compatibility. A minor/patch skew is
     * reported as [VersionCompatibility.MINOR_MISMATCH] so the client can warn without refusing to
     * play. Anything unparseable or major-divergent is [VersionCompatibility.INCOMPATIBLE].
     */
    fun versionCompatibility(serverVersion: String): VersionCompatibility {
        if (serverVersion == PROTOCOL_VERSION) return VersionCompatibility.MATCH

        val server = parseSemver(serverVersion) ?: return VersionCompatibility.INCOMPATIBLE
        val client = parseSemver(PROTOCOL_VERSION) ?: return VersionCompatibility.INCOMPATIBLE

        return when {
            server.first != client.first -> VersionCompatibility.INCOMPATIBLE
            else -> VersionCompatibility.MINOR_MISMATCH
        }
    }

    /** Parse "major.minor.patch" into (major, minor, patch). Returns null if malformed. */
    private fun parseSemver(version: String): Triple<Int, Int, Int>? {
        val parts = version.trim().split('.')
        if (parts.size < 2) return null
        val major = parts[0].toIntOrNull() ?: return null
        val minor = parts[1].toIntOrNull() ?: return null
        val patch = parts.getOrNull(2)?.toIntOrNull() ?: 0
        return Triple(major, minor, patch)
    }
}
