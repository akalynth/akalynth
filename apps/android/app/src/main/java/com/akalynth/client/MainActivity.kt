package com.akalynth.client

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import com.akalynth.client.game.GameStore
import com.akalynth.client.network.ConnectionState
import com.akalynth.client.network.WsClient
import com.akalynth.client.ui.screens.LoginScreen
import com.akalynth.client.ui.screens.WorldScreen
import com.akalynth.client.ui.theme.AkalynthTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

class MainActivity : ComponentActivity() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val wsClient = WsClient(BuildConfig.WS_BASE_URL, scope)
        val gameStore = GameStore(wsClient, scope, applicationContext)

        setContent {
            AkalynthTheme(darkTheme = true) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val state by gameStore.state.collectAsState()

                    when (state.connection) {
                        is ConnectionState.Idle,
                        is ConnectionState.Disconnected,
                        is ConnectionState.Error -> {
                            LoginScreen(
                                state = state,
                                onEvent = gameStore::onEvent
                            )
                        }
                        else -> {
                            WorldScreen(
                                state = state,
                                onEvent = gameStore::onEvent
                            )
                        }
                    }
                }
            }
        }
    }
}
