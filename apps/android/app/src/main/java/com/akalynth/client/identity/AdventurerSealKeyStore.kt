package com.akalynth.client.identity

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec

object AdventurerSealKeyStore {
    private const val KEYSTORE = "AndroidKeyStore"
    private const val ALIAS = "akalynth_adventurer_seal_v1"

    fun ensurePublicKeyPem(): String {
        val store = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        if (!store.containsAlias(ALIAS)) {
            val generator = KeyPairGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_EC,
                KEYSTORE
            )
            val spec = KeyGenParameterSpec.Builder(
                ALIAS,
                KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
            )
                .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(false)
                .build()
            generator.initialize(spec)
            generator.generateKeyPair()
        }
        val cert = store.getCertificate(ALIAS)
        val publicBytes = cert.publicKey.encoded
        val b64 = Base64.encodeToString(publicBytes, Base64.NO_WRAP)
        return "-----BEGIN PUBLIC KEY-----\n$b64\n-----END PUBLIC KEY-----"
    }

    fun signCanonicalPayload(canonicalPayload: String): String {
        val store = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        val key = store.getKey(ALIAS, null) as? PrivateKey
            ?: throw IllegalStateException("Adventurer Seal key is missing")
        val signature = Signature.getInstance("SHA256withECDSA")
        signature.initSign(key)
        signature.update(canonicalPayload.toByteArray(Charsets.UTF_8))
        return Base64.encodeToString(
            signature.sign(),
            Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING
        )
    }
}
