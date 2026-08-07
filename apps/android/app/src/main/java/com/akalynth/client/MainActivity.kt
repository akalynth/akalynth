package com.akalynth.client

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import com.akalynth.client.game.GameEvent
import com.akalynth.client.game.GameStore
import com.akalynth.client.network.ConnectionState
import com.akalynth.client.network.WsClient
import com.akalynth.client.ui.components.ClientUpdateOverlay
import com.akalynth.client.ui.screens.LoginScreen
import com.akalynth.client.ui.screens.WorldScreen
import com.akalynth.client.ui.theme.AkalynthTheme
import com.akalynth.client.update.ClientUpdateController
import com.akalynth.client.update.ClientUpdateState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

class MainActivity : ComponentActivity() {
    companion object {
        const val EXTRA_AUTO_CONNECT = "com.akalynth.client.AUTO_CONNECT"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var autoConnectPending = false
    private lateinit var gameStore: GameStore
    private lateinit var clientUpdateController: ClientUpdateController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        autoConnectPending = intent.getBooleanExtra(EXTRA_AUTO_CONNECT, false)

        val wsClient = WsClient(BuildConfig.WS_BASE_URL, scope)
        gameStore = GameStore(wsClient, scope, applicationContext)
        clientUpdateController = ClientUpdateController(applicationContext)

        setContent {
            AkalynthTheme(darkTheme = true) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val state by gameStore.state.collectAsState()
                    val updateState by clientUpdateController.state.collectAsState()
                    val updateController = remember { clientUpdateController }
                    val lifecycleOwner = LocalLifecycleOwner.current

                    // Self-update on every app start / resume (Lifecycle STARTED).
                    LaunchedEffect(lifecycleOwner, updateController) {
                        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
                            updateController.checkAndUpdate()
                        }
                    }
                    LaunchedEffect(state.connection, updateState) {
                        if (
                            autoConnectPending &&
                            state.connection is ConnectionState.Idle &&
                            !updateController.blocksLogin
                        ) {
                            autoConnectPending = false
                            gameStore.onEvent(GameEvent.Connect)
                        }
                    }

                    Box(modifier = Modifier.fillMaxSize()) {
                        when (state.connection) {
                            is ConnectionState.Idle,
                            is ConnectionState.Disconnected,
                            is ConnectionState.Error -> {
                                LoginScreen(
                                    state = state,
                                    onEvent = gameStore::onEvent,
                                    onCreateCharacter = {
                                        startActivity(
                                            Intent(
                                                this@MainActivity,
                                                CharacterCreateActivity::class.java
                                            )
                                        )
                                    },
                                    onAdventurerSeal = {
                                        startActivity(
                                            Intent(
                                                this@MainActivity,
                                                AdventurerSealActivity::class.java
                                            )
                                        )
                                    }
                                )
                            }
                            else -> {
                                WorldScreen(
                                    state = state,
                                    onEvent = gameStore::onEvent
                                )
                            }
                        }
                        if (updateState is ClientUpdateState.Checking ||
                            updateState is ClientUpdateState.Downloading ||
                            updateState is ClientUpdateState.ReadyToInstall ||
                            updateState is ClientUpdateState.NeedsInstallPermission ||
                            updateState is ClientUpdateState.Failed
                        ) {
                            ClientUpdateOverlay(
                                state = updateState,
                                onOpenInstallPermission = {
                                    updateController.openInstallPermissionSettings()
                                },
                            )
                        }
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.getBooleanExtra(EXTRA_AUTO_CONNECT, false)) {
            autoConnectPending = true
            if (::gameStore.isInitialized) {
                gameStore.onEvent(GameEvent.Connect)
                autoConnectPending = false
            }
        }
    }
}
