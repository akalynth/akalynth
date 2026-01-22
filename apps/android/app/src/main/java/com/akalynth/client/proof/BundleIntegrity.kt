package com.akalynth.client.proof

import java.security.MessageDigest

/**
 * Integrity verification data for a proof bundle.
 *
 * Provides cryptographic binding of bundle contents for tamper detection.
 * The contentHash covers the canonical JSON representation of all bundle data.
 *
 * @property contentHash SHA-256 hash of the canonical bundle content
 * @property algorithm Hash algorithm used (for future extensibility)
 * @property receiptChainHash Hash of the receipt chain at bundle creation (if available)
 * @property signature Optional external signature (e.g., from VaultMesh)
 * @property merkleRoot Optional merkle root if part of a tree
 */
data class BundleIntegrity(
    val contentHash: String,
    val algorithm: String = "SHA-256",
    val receiptChainHash: String? = null,
    val signature: String? = null,
    val merkleRoot: String? = null
) {
    /**
     * Check if this bundle has a signature.
     */
    val isSigned: Boolean get() = signature != null

    /**
     * Check if this bundle is part of a merkle tree.
     */
    val hasMerkleProof: Boolean get() = merkleRoot != null

    companion object {
        /**
         * Compute SHA-256 hash of content.
         */
        fun computeHash(content: String): String {
            val digest = MessageDigest.getInstance("SHA-256")
            val bytes = digest.digest(content.toByteArray(Charsets.UTF_8))
            return bytes.joinToString("") { "%02x".format(it) }
        }

        /**
         * Create integrity with computed content hash.
         */
        fun fromContent(
            canonicalContent: String,
            receiptChainHash: String? = null
        ) = BundleIntegrity(
            contentHash = computeHash(canonicalContent),
            receiptChainHash = receiptChainHash
        )

        /**
         * Create integrity with pre-computed hash.
         */
        fun withHash(
            hash: String,
            receiptChainHash: String? = null
        ) = BundleIntegrity(
            contentHash = hash,
            receiptChainHash = receiptChainHash
        )
    }
}
