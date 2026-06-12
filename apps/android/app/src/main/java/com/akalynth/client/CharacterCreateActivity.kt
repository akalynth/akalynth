package com.akalynth.client

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputFilter
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.Spinner
import android.widget.TextView
import com.akalynth.client.network.IdentityApi
import com.akalynth.client.network.IdentityStore
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class CharacterCreateActivity : Activity() {
    private lateinit var nameInput: EditText
    private lateinit var emailInput: EditText
    private lateinit var passwordInput: EditText
    private lateinit var loginButton: Button
    private lateinit var accountPortalButton: Button
    private lateinit var selectButton: Button
    private lateinit var createButton: Button
    private lateinit var progress: ProgressBar
    private lateinit var statusText: TextView
    private lateinit var characterSpinner: Spinner
    private lateinit var worldSpinner: Spinner
    private lateinit var sexSpinner: Spinner
    private lateinit var outfitSpinner: Spinner

    private lateinit var worldAdapter: ArrayAdapter<String>
    private lateinit var characterAdapter: ArrayAdapter<String>
    private lateinit var sexAdapter: ArrayAdapter<String>
    private lateinit var outfitAdapter: ArrayAdapter<String>

    private val characters = mutableListOf<IdentityApi.Character>()
    private val worlds = mutableListOf<IdentityApi.World>()
    private val outfits = mutableListOf<IdentityApi.Outfit>()
    private val filteredOutfits = mutableListOf<IdentityApi.Outfit>()

    private val mainHandler = Handler(Looper.getMainLooper())
    private val identityApi = IdentityApi()
    private lateinit var store: IdentityStore

    private var selectedCharacterId: String? = null
    private var selectedWorldId: String? = null
    private var selectedSex: String = "male"
    private var selectedOutfitId: String? = null
    private var accountEmailVerified = false
    private var busy = false

    private var ws: WebSocket? = null
    private val wsClient = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        store = IdentityStore(this)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(40, 60, 40, 40)
        }

        val title = TextView(this).apply {
            text = "Create Character"
            textSize = 22f
        }

        nameInput = EditText(this).apply {
            hint = "Name (3-20, A-Z 0-9 _ -)"
            filters = arrayOf(InputFilter.LengthFilter(20))
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
                override fun afterTextChanged(s: Editable?) {
                    refreshCreateEnabled()
                }
            })
        }

        emailInput = EditText(this).apply {
            hint = "Email"
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
        }

        passwordInput = EditText(this).apply {
            hint = "Password"
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
        }

        loginButton = Button(this).apply {
            text = "Sign In"
            setOnClickListener { onLoginTapped() }
        }

        accountPortalButton = Button(this).apply {
            text = "Create / Verify Account"
            setOnClickListener { openAccountPortal() }
        }

        characterAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, ArrayList<String>())
        characterAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        characterSpinner = Spinner(this).apply {
            adapter = characterAdapter
            isEnabled = false
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                    selectedCharacterId = characters.getOrNull(position)?.characterId
                    refreshCreateEnabled()
                }

                override fun onNothingSelected(parent: AdapterView<*>?) {
                    selectedCharacterId = null
                    refreshCreateEnabled()
                }
            }
        }

        selectButton = Button(this).apply {
            text = "No Character Selected"
            setOnClickListener { onSelectTapped() }
            isEnabled = false
        }

        worldAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, ArrayList<String>())
        worldAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        worldSpinner = Spinner(this).apply {
            adapter = worldAdapter
            isEnabled = false
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                    selectedWorldId = worlds.getOrNull(position)?.worldId
                    refreshCreateEnabled()
                }

                override fun onNothingSelected(parent: AdapterView<*>?) {
                    selectedWorldId = null
                    refreshCreateEnabled()
                }
            }
        }

        sexAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, listOf("male", "female").toMutableList())
        sexAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        sexSpinner = Spinner(this).apply {
            adapter = sexAdapter
            setSelection(0)
            isEnabled = false
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                    selectedSex = when (position) {
                        1 -> "female"
                        else -> "male"
                    }
                    refreshOutfitSpinner()
                    refreshCreateEnabled()
                }

                override fun onNothingSelected(parent: AdapterView<*>?) {
                    selectedSex = "male"
                    refreshOutfitSpinner()
                    refreshCreateEnabled()
                }
            }
        }

        outfitAdapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, ArrayList<String>())
        outfitAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        outfitSpinner = Spinner(this).apply {
            adapter = outfitAdapter
            isEnabled = false
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                    selectedOutfitId = filteredOutfits.getOrNull(position)?.outfitId
                    refreshCreateEnabled()
                }

                override fun onNothingSelected(parent: AdapterView<*>?) {
                    selectedOutfitId = null
                    refreshCreateEnabled()
                }
            }
        }

        createButton = Button(this).apply {
            text = "Create Character"
            setOnClickListener { onCreateTapped() }
            isEnabled = false
        }

        progress = ProgressBar(this).apply {
            visibility = View.GONE
        }

        statusText = TextView(this).apply {
            textSize = 14f
            setPadding(0, 20, 0, 0)
        }

        root.addView(title, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(nameInput, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(TextView(this).apply { text = "Sign in required"; textSize = 12f },
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(emailInput, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(passwordInput, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(loginButton, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(accountPortalButton, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(TextView(this).apply { text = "Existing characters"; textSize = 12f },
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(characterSpinner, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(selectButton, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(TextView(this).apply { text = "World"; textSize = 12f },
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(worldSpinner, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(TextView(this).apply { text = "Sex"; textSize = 12f },
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(sexSpinner, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(TextView(this).apply { text = "Outfit"; textSize = 12f },
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(outfitSpinner, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(createButton, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(progress, LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(statusText, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)

        setContentView(root)

        loadCatalogs()
        maybeAutoLogin()
    }

    override fun onDestroy() {
        ws?.close(1000, "bye")
        ws = null
        super.onDestroy()
    }

    private fun onLoginTapped() {
        if (busy) return

        val email = emailInput.text?.toString()?.trim().orEmpty()
        val password = passwordInput.text?.toString().orEmpty()
        if (email.isBlank() || password.isBlank()) {
            setStatus("Enter both email and password.")
            return
        }

        setLoading(true)
        setStatus("Signing in...")
        identityApi.login(email, password, object : IdentityApi.LoginCallback {
            override fun onResult(result: IdentityApi.LoginResult) {
                mainHandler.post {
                    when (result) {
                        is IdentityApi.LoginResult.Success -> {
                            setLoading(false)
                            accountEmailVerified = result.account.emailVerified
                            val verified = if (result.account.emailVerified) "Email verified" else "Email pending"
                            setStatus("Signed in (${result.account.accountId.take(8)}) - $verified")
                            loadCharacters()
                            refreshCreateEnabled()
                        }
                        is IdentityApi.LoginResult.Error -> {
                            setLoading(false)
                            accountEmailVerified = false
                            setStatus(mapError(result.code, result.message))
                        }
                    }
                }
            }
        })
    }

    private fun openAccountPortal() {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.PORTAL_ACCOUNT_URL))
        startActivity(intent)
    }

    private fun onCreateTapped() {
        if (busy) return
        val name = nameInput.text?.toString()?.trim().orEmpty()
        if (name.isBlank()) {
            setStatus("Enter a name.")
            return
        }
        val hasAccountSession = identityApi.hasAccountSession()
        if (!hasAccountSession) {
            setStatus("Sign in required to create a character.")
            return
        }
        if (!accountEmailVerified) {
            setStatus("Verify your email before creating account characters.")
            return
        }
        if (selectedWorldId.isNullOrBlank() || selectedOutfitId.isNullOrBlank()) {
            setStatus("Select world and outfit first.")
            return
        }
        val worldId = selectedWorldId ?: return
        val outfitId = selectedOutfitId ?: return

        setLoading(true)
        setStatus("Creating...")
        identityApi.createCharacter(
            name,
            worldId = worldId,
            sex = selectedSex,
            outfitId = outfitId,
            callback = object : IdentityApi.CreateCallback {
                override fun onResult(result: IdentityApi.CharacterCreateResult) {
                    mainHandler.post {
                        when (result) {
                            is IdentityApi.CharacterCreateResult.Success -> {
                                store.save(
                                    playerId = result.playerId,
                                    name = result.name,
                                    token = result.token,
                                    expiresAt = result.expiresAt
                                )
                                setStatus("Created: ${result.name}. Connecting...")
                                loadCharacters()
                                connectWsAndLogin(result.token)
                            }
                            is IdentityApi.CharacterCreateResult.Error -> {
                                setLoading(false)
                                setStatus(mapError(result.code, result.message))
                            }
                        }
                    }
                }
            }
        )
    }

    private fun onSelectTapped() {
        if (busy) return
        val characterId = selectedCharacterId
        if (characterId.isNullOrBlank()) {
            setStatus("Select an existing character first.")
            return
        }

        setLoading(true)
        setStatus("Selecting character...")
        identityApi.selectCharacter(characterId, object : IdentityApi.CreateCallback {
            override fun onResult(result: IdentityApi.CharacterCreateResult) {
                mainHandler.post {
                    when (result) {
                        is IdentityApi.CharacterCreateResult.Success -> {
                            store.save(
                                playerId = result.playerId,
                                name = result.name,
                                token = result.token,
                                expiresAt = result.expiresAt
                            )
                            setStatus("Selected: ${result.name}. Connecting...")
                            connectWsAndLogin(result.token)
                        }
                        is IdentityApi.CharacterCreateResult.Error -> {
                            setLoading(false)
                            setStatus(mapError(result.code, result.message))
                        }
                    }
                }
            }
        })
    }

    private fun loadCatalogs() {
        setStatus("Loading character catalog...")
        identityApi.loadWorlds(object : IdentityApi.CatalogCallback<IdentityApi.World> {
            override fun onSuccess(items: List<IdentityApi.World>) {
                mainHandler.post {
                    worlds.clear()
                    worlds.addAll(items)
                    worldAdapter.clear()
                    worldAdapter.addAll(items.map { it.name.ifBlank { it.worldId } })
                    if (items.isNotEmpty()) {
                        selectedWorldId = items[0].worldId
                        worldSpinner.setSelection(0)
                        setStatus("Worlds loaded.")
                    } else {
                        worldAdapter.add("No worlds available")
                        selectedWorldId = null
                    }
                    worldSpinner.isEnabled = identityApi.hasAccountSession()
                    refreshCreateEnabled()
                }
            }

            override fun onError(code: String, message: String) {
                mainHandler.post {
                    worldAdapter.clear()
                    worldAdapter.add("Worlds unavailable")
                    selectedWorldId = null
                    worldSpinner.isEnabled = identityApi.hasAccountSession()
                    setStatus("World catalog: $code")
                    refreshCreateEnabled()
                }
            }
        })

        identityApi.loadOutfits(object : IdentityApi.CatalogCallback<IdentityApi.Outfit> {
            override fun onSuccess(items: List<IdentityApi.Outfit>) {
                mainHandler.post {
                    outfits.clear()
                    outfits.addAll(items)
                    refreshOutfitSpinner()
                    outfitSpinner.isEnabled = identityApi.hasAccountSession()
                    setStatus("Outfit catalog loaded.")
                    refreshCreateEnabled()
                }
            }

            override fun onError(code: String, message: String) {
                mainHandler.post {
                    outfits.clear()
                    refreshOutfitSpinner()
                    setStatus("Outfit catalog: $code")
                    refreshCreateEnabled()
                }
            }
        })

        refreshCreateEnabled()
    }

    private fun loadCharacters() {
        if (!identityApi.hasAccountSession()) {
            characters.clear()
            characterAdapter.clear()
            selectedCharacterId = null
            accountEmailVerified = false
            refreshCreateEnabled()
            return
        }

        identityApi.loadCharacters(object : IdentityApi.CatalogCallback<IdentityApi.Character> {
            override fun onSuccess(items: List<IdentityApi.Character>) {
                mainHandler.post {
                    characters.clear()
                    characters.addAll(items)
                    characterAdapter.clear()
                    if (items.isEmpty()) {
                        characterAdapter.add("No characters yet")
                        selectedCharacterId = null
                        setStatus("No existing characters. Create one below.")
                    } else {
                        characterAdapter.addAll(items.map { character ->
                            val world = character.worldId.ifBlank { "world" }
                            val outfit = character.outfitId.ifBlank { "outfit" }
                            "${character.name.ifBlank { character.characterId }} - $world - $outfit"
                        })
                        selectedCharacterId = items[0].characterId
                        characterSpinner.setSelection(0)
                        setStatus("Select a character to play, or create a new one.")
                    }
                    refreshCreateEnabled()
                }
            }

            override fun onError(code: String, message: String) {
                mainHandler.post {
                    characters.clear()
                    characterAdapter.clear()
                    characterAdapter.add("Characters unavailable")
                    selectedCharacterId = null
                    setStatus("Character list: $code")
                    refreshCreateEnabled()
                }
            }
        })
    }

    private fun refreshOutfitSpinner() {
        val selectedOutfit = selectedOutfitId
        filteredOutfits.clear()
        filteredOutfits.addAll(
            outfits.filter { it.sex.equals(selectedSex, ignoreCase = true) }
        )
        if (filteredOutfits.isEmpty()) {
            filteredOutfits.addAll(outfits)
        }

        outfitAdapter.clear()
        if (filteredOutfits.isEmpty()) {
            outfitAdapter.add("No outfits available")
            selectedOutfitId = null
            return
        }

        outfitAdapter.addAll(filteredOutfits.map { it.name.ifBlank { it.outfitId } })
        val fallback = filteredOutfits.indexOfFirst { it.outfitId == selectedOutfit }
        val nextIndex = if (fallback >= 0) fallback else 0
        selectedOutfitId = filteredOutfits.getOrNull(nextIndex)?.outfitId
        if (outfitSpinner.isShown) {
            outfitSpinner.setSelection(nextIndex)
        }
    }

    private fun maybeAutoLogin() {
        if (!store.isTokenValid()) return
        val token = store.getToken() ?: return
        val name = store.getPlayerName() ?: "Adventurer"
        setLoading(true)
        setStatus("Reconnecting as $name...")
        connectWsAndLogin(token)
    }

    private fun connectWsAndLogin(token: String) {
        ws?.close(1000, "reconnect")
        val request = Request.Builder()
            .url(BuildConfig.WS_BASE_URL)
            .build()

        ws = wsClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                // wait for welcome
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val obj = runCatching { JSONObject(text) }.getOrNull() ?: return
                when (obj.optString("type")) {
                    "welcome" -> {
                        val login = JSONObject().apply {
                            put("type", "login")
                            put("token", token)
                            put("guest_token", JSONObject.NULL)
                        }
                        webSocket.send(login.toString())
                        mainHandler.post { setStatus("Logging in...") }
                    }
                    "login_ack" -> {
                        if (obj.optBoolean("ok", false)) {
                            val name = obj.optString("name")
                            val newToken = obj.optString("token").takeIf { it.isNotBlank() }
                            val expiresAt = obj.optLong("expires_at", 0L)
                            val playerId = obj.optString("player_id")

                            if (newToken != null && expiresAt > 0 && playerId.isNotBlank()) {
                                store.saveIfNewer(playerId, name, newToken, expiresAt)
                            }

                            mainHandler.post {
                                setLoading(false)
                                setStatus("Welcome, $name!")
                                mainHandler.postDelayed({
                                    startActivity(
                                        Intent(this@CharacterCreateActivity, MainActivity::class.java).apply {
                                            putExtra(MainActivity.EXTRA_AUTO_CONNECT, true)
                                            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                                        }
                                    )
                                    finish()
                                }, 2000)
                            }
                        } else {
                            val reason = obj.optString("reason", "login failed")
                            mainHandler.post {
                                setLoading(false)
                                setStatus("Login failed: $reason")
                            }
                        }
                    }
                    "error" -> {
                        val code = obj.optString("code")
                        val msg = obj.optString("message")
                        mainHandler.post {
                            setLoading(false)
                            if (code == "token_invalid" || code == "token_expired") {
                                store.clear()
                                setStatus("Session expired. Please create a character again.")
                            } else {
                                setStatus("Error: $code - $msg")
                            }
                        }
                    }
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                mainHandler.post {
                    setLoading(false)
                    setStatus("WS failed: ${t.message ?: "unknown error"}")
                }
            }
        })
    }

    private fun refreshCreateEnabled() {
        val hasAccount = identityApi.hasAccountSession()
        val sessionMessage = identityApi.accountCharacterSessionMessage("creation")
        worldSpinner.isEnabled = hasAccount && worlds.isNotEmpty() && !busy
        characterSpinner.isEnabled = hasAccount && characters.isNotEmpty() && !busy
        sexSpinner.isEnabled = hasAccount && !busy
        outfitSpinner.isEnabled = hasAccount && filteredOutfits.isNotEmpty() && !busy
        loginButton.isEnabled = !busy
        accountPortalButton.isEnabled = !busy
        selectButton.isEnabled = hasAccount && !busy && selectedCharacterId != null

        val nameReady = nameInput.text?.toString()?.trim()?.isNotBlank() == true
        val canCreate = hasAccount && accountEmailVerified && !busy && nameReady && selectedWorldId != null && selectedOutfitId != null
        createButton.text = "Create Character"
        createButton.isEnabled = canCreate
        selectButton.text = if (selectedCharacterId != null) "Play Selected Character" else "No Character Selected"
        nameInput.isEnabled = !busy
        emailInput.isEnabled = !busy
        passwordInput.isEnabled = !busy
        if (!busy) {
            when {
                sessionMessage != null -> setStatus(sessionMessage)
                !accountEmailVerified -> setStatus("Verify email before creating; existing characters can still be selected.")
                selectedWorldId == null || selectedOutfitId == null -> setStatus("Select world and outfit first.")
            }
        }
        if (busy) {
            progress.visibility = View.VISIBLE
        } else {
            progress.visibility = View.GONE
        }
    }

    private fun setLoading(on: Boolean) {
        busy = on
        refreshCreateEnabled()
    }

    private fun setStatus(msg: String) {
        statusText.text = msg
    }

    private fun mapError(code: String, message: String): String {
        return when (code) {
            "invalid_name" -> "Name must be 3-20 chars, start with a letter, and use only letters/numbers/-/_"
            "name_taken" -> "That name is already taken."
            "rate_limited" -> "Too many attempts. Try again later."
            "banned" -> "Account banned."
            "network_error" -> "Network error: $message"
            "not_authenticated" -> "Sign in first for account character creation."
            "csrf_missing" -> "Security token missing. Sign in again before account character creation."
            "csrf_failed" -> "Session expired. Sign out and sign in again."
            "email_unverified" -> "Verify your email before creating account characters."
            else -> "Error ($code): $message"
        }
    }
}
