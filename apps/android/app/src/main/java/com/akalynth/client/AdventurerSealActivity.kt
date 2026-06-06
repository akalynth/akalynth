package com.akalynth.client

import android.app.Activity
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputFilter
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import com.akalynth.client.identity.AdventurerSealKeyStore
import com.akalynth.client.network.IdentityApi
import com.akalynth.client.network.IdentityStore

class AdventurerSealActivity : Activity() {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val identityApi = IdentityApi()
    private lateinit var store: IdentityStore

    private lateinit var handleInput: EditText
    private lateinit var targetInput: EditText
    private lateinit var reasonInput: EditText
    private lateinit var statusText: TextView
    private lateinit var progress: ProgressBar
    private lateinit var claimButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = IdentityStore(this)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(36, 48, 36, 48)
        }

        root.addView(TextView(this).apply {
            text = "Adventurer Seal"
            textSize = 24f
        })
        root.addView(TextView(this).apply {
            text = "A Seal is a persistent key-bound identity. The private key stays on this device where possible. The server receives your handle, public key, public key fingerprint, reports, blocks, sessions, and deletion state. Your handle and signed-post status may be public. V1 has no recovery: losing this device or app data may lose the Seal."
            textSize = 14f
            setPadding(0, 16, 0, 16)
        })

        handleInput = EditText(this).apply {
            hint = "Handle (3-32, A-Z 0-9 _ -)"
            filters = arrayOf(InputFilter.LengthFilter(32))
        }
        root.addView(handleInput, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)

        claimButton = Button(this).apply {
            text = "Claim Adventurer Seal"
            setOnClickListener { claimSeal() }
        }
        root.addView(claimButton, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)

        progress = ProgressBar(this).apply { visibility = View.GONE }
        root.addView(progress, LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)

        root.addView(TextView(this).apply {
            text = "Trust & Safety"
            textSize = 18f
            setPadding(0, 28, 0, 8)
        })
        targetInput = EditText(this).apply {
            hint = "Target principal_id"
            filters = arrayOf(InputFilter.LengthFilter(80))
        }
        reasonInput = EditText(this).apply {
            hint = "Reason"
            filters = arrayOf(InputFilter.LengthFilter(80))
        }
        root.addView(targetInput, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(reasonInput, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)

        root.addView(Button(this).apply {
            text = "Report Principal"
            setOnClickListener { reportPrincipal() }
        }, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(Button(this).apply {
            text = "Block Principal"
            setOnClickListener { blockPrincipal() }
        }, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)

        root.addView(TextView(this).apply {
            text = "Deletion & Retirement"
            textSize = 18f
            setPadding(0, 28, 0, 8)
        })
        root.addView(Button(this).apply {
            text = "Retire Seal"
            setOnClickListener { signedSelfAction("principal_retire") }
        }, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(Button(this).apply {
            text = "Request Seal Deletion"
            setOnClickListener { signedSelfAction("principal_delete") }
        }, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)

        statusText = TextView(this).apply {
            textSize = 14f
            setPadding(0, 20, 0, 0)
        }
        root.addView(statusText, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)

        setContentView(ScrollView(this).apply { addView(root) })
        refreshStatus()
    }

    private fun claimSeal() {
        val handle = handleInput.text?.toString()?.trim().orEmpty()
        if (handle.isBlank()) return setStatus("Enter a handle.")
        setLoading(true)
        setStatus("Generating device-bound key...")
        val publicKeyPem = runCatching { AdventurerSealKeyStore.ensurePublicKeyPem() }.getOrElse {
            setLoading(false)
            setStatus("Key generation failed: ${it.message}")
            return
        }
        identityApi.registerPrincipal(handle, publicKeyPem, object : IdentityApi.PrincipalCallback {
            override fun onResult(result: IdentityApi.PrincipalResult) {
                mainHandler.post {
                    when (result) {
                        is IdentityApi.PrincipalResult.Registered -> {
                            setStatus("${result.lossWarning}\nRequesting login challenge...")
                            loginWithChallenge(result.principalId)
                        }
                        is IdentityApi.PrincipalResult.Error -> {
                            setLoading(false)
                            setStatus("Seal registration failed: ${result.code}")
                        }
                        else -> Unit
                    }
                }
            }
        })
    }

    private fun loginWithChallenge(principalId: String) {
        identityApi.requestPrincipalChallenge(principalId, "principal_login", object : IdentityApi.PrincipalCallback {
            override fun onResult(result: IdentityApi.PrincipalResult) {
                mainHandler.post {
                    when (result) {
                        is IdentityApi.PrincipalResult.Challenge -> {
                            val signature = runCatching {
                                AdventurerSealKeyStore.signCanonicalPayload(result.canonicalPayload)
                            }.getOrElse {
                                setLoading(false)
                                setStatus("Signing failed: ${it.message}")
                                return@post
                            }
                            identityApi.verifyPrincipalChallenge(
                                principalId,
                                result.challengeId,
                                signature,
                                sealCallback("Seal active.") { session ->
                                    store.savePrincipal(
                                        principalId = session.principalId,
                                        handle = session.handle,
                                        sessionToken = session.sessionToken,
                                        expiresAtIso = session.expiresAt
                                    )
                                }
                            )
                        }
                        is IdentityApi.PrincipalResult.Error -> {
                            setLoading(false)
                            setStatus("Challenge failed: ${result.code}")
                        }
                        else -> Unit
                    }
                }
            }
        })
    }

    private fun reportPrincipal() {
        val token = requireSession() ?: return
        val target = targetInput.text?.toString()?.trim().orEmpty()
        val reason = reasonInput.text?.toString()?.trim().orEmpty()
        if (target.isBlank() || reason.isBlank()) return setStatus("Enter target principal_id and reason.")
        setLoading(true)
        identityApi.reportPrincipal(token, target, reason, reason, basicCallback())
    }

    private fun blockPrincipal() {
        val token = requireSession() ?: return
        val target = targetInput.text?.toString()?.trim().orEmpty()
        val reason = reasonInput.text?.toString()?.trim().orEmpty()
        if (target.isBlank()) return setStatus("Enter target principal_id.")
        setLoading(true)
        identityApi.blockPrincipal(token, target, reason, basicCallback())
    }

    private fun signedSelfAction(purpose: String) {
        val principalId = store.getPrincipalId()
        val token = requireSession() ?: return
        if (principalId.isNullOrBlank()) return setStatus("No saved Seal.")
        setLoading(true)
        identityApi.requestPrincipalChallenge(principalId, purpose, object : IdentityApi.PrincipalCallback {
            override fun onResult(result: IdentityApi.PrincipalResult) {
                mainHandler.post {
                    when (result) {
                        is IdentityApi.PrincipalResult.Challenge -> {
                            val signature = runCatching {
                                AdventurerSealKeyStore.signCanonicalPayload(result.canonicalPayload)
                            }.getOrElse {
                                setLoading(false)
                                setStatus("Signing failed: ${it.message}")
                                return@post
                            }
                            if (purpose == "principal_retire") {
                                identityApi.retirePrincipal(token, result.challengeId, signature, destructiveCallback())
                            } else {
                                identityApi.deletePrincipal(token, result.challengeId, signature, destructiveCallback())
                            }
                        }
                        is IdentityApi.PrincipalResult.Error -> {
                            setLoading(false)
                            setStatus("Challenge failed: ${result.code}")
                        }
                        else -> Unit
                    }
                }
            }
        })
    }

    private fun requireSession(): String? {
        val token = store.getPrincipalSessionToken()
        if (token.isNullOrBlank()) {
            setStatus("Create or log in with an Adventurer Seal first.")
            return null
        }
        return token
    }

    private fun sealCallback(
        successMessage: String,
        onSession: (IdentityApi.PrincipalResult.Session) -> Unit
    ) = object : IdentityApi.PrincipalCallback {
        override fun onResult(result: IdentityApi.PrincipalResult) {
            mainHandler.post {
                setLoading(false)
                when (result) {
                    is IdentityApi.PrincipalResult.Session -> {
                        onSession(result)
                        setStatus(successMessage)
                        refreshStatus()
                    }
                    is IdentityApi.PrincipalResult.Error -> setStatus("Seal login failed: ${result.code}")
                    else -> Unit
                }
            }
        }
    }

    private fun basicCallback() = object : IdentityApi.PrincipalCallback {
        override fun onResult(result: IdentityApi.PrincipalResult) {
            mainHandler.post {
                setLoading(false)
                when (result) {
                    is IdentityApi.PrincipalResult.Ok -> setStatus(result.message)
                    is IdentityApi.PrincipalResult.Error -> setStatus("Request failed: ${result.code}")
                    else -> Unit
                }
            }
        }
    }

    private fun destructiveCallback() = object : IdentityApi.PrincipalCallback {
        override fun onResult(result: IdentityApi.PrincipalResult) {
            mainHandler.post {
                setLoading(false)
                when (result) {
                    is IdentityApi.PrincipalResult.Ok -> {
                        store.clearPrincipal()
                        setStatus(result.message)
                        refreshStatus()
                    }
                    is IdentityApi.PrincipalResult.Error -> setStatus("Request failed: ${result.code}")
                    else -> Unit
                }
            }
        }
    }

    private fun refreshStatus() {
        val principal = store.getPrincipalHandle()
        val id = store.getPrincipalId()
        if (!principal.isNullOrBlank() && !id.isNullOrBlank()) {
            statusText.text = "Identity Seal: Active\nHandle: $principal\nPrincipal: $id"
        }
    }

    private fun setLoading(on: Boolean) {
        progress.visibility = if (on) View.VISIBLE else View.GONE
        claimButton.isEnabled = !on
    }

    private fun setStatus(message: String) {
        statusText.text = message
    }
}
