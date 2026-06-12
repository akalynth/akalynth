package com.akalynth.client.network

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.ServerSocket
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class IdentityApiAccountCharacterTest {
    @Test
    fun `create character requires account session before network request`() {
        val api = IdentityApi("http://127.0.0.1:1")
        var result: IdentityApi.CharacterCreateResult? = null

        api.createCharacter(
            name = "Sovereign",
            worldId = "rookguard",
            sex = "male",
            outfitId = "male_wanderer",
            callback = object : IdentityApi.CreateCallback {
                override fun onResult(next: IdentityApi.CharacterCreateResult) {
                    result = next
                }
            }
        )

        val error = result as? IdentityApi.CharacterCreateResult.Error
        assertTrue(error != null)
        assertEquals("not_authenticated", error?.code)
        assertEquals("Sign in required for account character creation.", error?.message)
    }

    @Test
    fun `select character requires account session before network request`() {
        val api = IdentityApi("http://127.0.0.1:1")
        var result: IdentityApi.CharacterCreateResult? = null

        api.selectCharacter(
            characterId = "p_test",
            callback = object : IdentityApi.CreateCallback {
                override fun onResult(next: IdentityApi.CharacterCreateResult) {
                    result = next
                }
            }
        )

        val error = result as? IdentityApi.CharacterCreateResult.Error
        assertTrue(error != null)
        assertEquals("not_authenticated", error?.code)
        assertEquals("Sign in required for account character selection.", error?.message)
    }

    @Test
    fun `create character requires csrf-ready account session before network request`() {
        val api = IdentityApi("http://127.0.0.1:1")
        setSessionCookieOnly(api)
        var result: IdentityApi.CharacterCreateResult? = null

        api.createCharacter(
            name = "Sovereign",
            worldId = "rookguard",
            sex = "male",
            outfitId = "male_wanderer",
            callback = object : IdentityApi.CreateCallback {
                override fun onResult(next: IdentityApi.CharacterCreateResult) {
                    result = next
                }
            }
        )

        val error = result as? IdentityApi.CharacterCreateResult.Error
        assertTrue(error != null)
        assertEquals("csrf_missing", error?.code)
        assertEquals("Security token missing. Sign in again before account character creation.", error?.message)
        assertEquals(
            "Security token missing. Sign in again before account character creation.",
            api.accountCharacterSessionMessage("creation")
        )
    }

    @Test
    fun `select character requires csrf-ready account session before network request`() {
        val api = IdentityApi("http://127.0.0.1:1")
        setSessionCookieOnly(api)
        var result: IdentityApi.CharacterCreateResult? = null

        api.selectCharacter(
            characterId = "p_test",
            callback = object : IdentityApi.CreateCallback {
                override fun onResult(next: IdentityApi.CharacterCreateResult) {
                    result = next
                }
            }
        )

        val error = result as? IdentityApi.CharacterCreateResult.Error
        assertTrue(error != null)
        assertEquals("csrf_missing", error?.code)
        assertEquals("Security token missing. Sign in again before account character selection.", error?.message)
    }

    @Test
    fun `load worlds uses v1 worlds and filters legacy ids`() {
        withCatalogServer(
            path = "/v1/worlds",
            body = """{"worlds":[{"world_id":"rookguard","name":"Rookguard"},{"world_id":"azura","name":"Azura"},{"world_id":"high_city","name":"High City"}]}"""
        ) { baseUrl, requestedPath ->
            val api = IdentityApi(baseUrl)
            val latch = CountDownLatch(1)
            var worlds: List<IdentityApi.World> = emptyList()
            var error: String? = null

            api.loadWorlds(object : IdentityApi.CatalogCallback<IdentityApi.World> {
                override fun onSuccess(items: List<IdentityApi.World>) {
                    worlds = items
                    latch.countDown()
                }

                override fun onError(code: String, message: String) {
                    error = "$code:$message"
                    latch.countDown()
                }
            })

            assertTrue("catalog callback timed out", latch.await(2, TimeUnit.SECONDS))
            assertEquals(null, error)
            assertEquals("/v1/worlds", requestedPath())
            assertEquals(listOf("rookguard", "high_city"), worlds.map { it.worldId })
        }
    }

    @Test
    fun `load outfits uses v1 outfits and filters invalid catalog entries`() {
        withCatalogServer(
            path = "/v1/outfits",
            body = """{"outfits":[{"outfit_id":"male_wanderer","sex":"male","name":"Wanderer"},{"outfit_id":"unknown","sex":"male","name":"Unknown"},{"outfit_id":"female_mage","sex":"female","name":"Apprentice Mage"},{"outfit_id":"male_guard","sex":"other","name":"Bad Sex"}]}"""
        ) { baseUrl, requestedPath ->
            val api = IdentityApi(baseUrl)
            val latch = CountDownLatch(1)
            var outfits: List<IdentityApi.Outfit> = emptyList()
            var error: String? = null

            api.loadOutfits(object : IdentityApi.CatalogCallback<IdentityApi.Outfit> {
                override fun onSuccess(items: List<IdentityApi.Outfit>) {
                    outfits = items
                    latch.countDown()
                }

                override fun onError(code: String, message: String) {
                    error = "$code:$message"
                    latch.countDown()
                }
            })

            assertTrue("catalog callback timed out", latch.await(2, TimeUnit.SECONDS))
            assertEquals(null, error)
            assertEquals("/v1/outfits", requestedPath())
            assertEquals(listOf("male_wanderer", "female_mage"), outfits.map { it.outfitId })
            assertEquals(listOf("male", "female"), outfits.map { it.sex })
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun setSessionCookieOnly(api: IdentityApi) {
        val field = IdentityApi::class.java.getDeclaredField("sessionCookies")
        field.isAccessible = true
        val cookies = field.get(api) as MutableMap<String, String>
        cookies["akalynth_session"] = "sess-test"
    }

    private fun withCatalogServer(
        path: String,
        body: String,
        test: (baseUrl: String, requestedPath: () -> String?) -> Unit
    ) {
        val server = ServerSocket(0)
        var requestedPath: String? = null
        val ready = CountDownLatch(1)
        val done = CountDownLatch(1)
        val thread = Thread {
            ready.countDown()
            server.accept().use { socket ->
                val reader = BufferedReader(InputStreamReader(socket.getInputStream(), Charsets.UTF_8))
                val requestLine = reader.readLine().orEmpty()
                requestedPath = requestLine.split(" ").getOrNull(1)?.substringBefore("?")
                while (reader.readLine().orEmpty().isNotEmpty()) {
                    // Drain headers.
                }
                val bytes = body.toByteArray(Charsets.UTF_8)
                val response = (
                    "HTTP/1.1 200 OK\r\n" +
                        "Content-Type: application/json\r\n" +
                        "Content-Length: ${bytes.size}\r\n" +
                        "Connection: close\r\n" +
                        "\r\n"
                    ).toByteArray(Charsets.UTF_8)
                socket.getOutputStream().use { out ->
                    out.write(response)
                    out.write(bytes)
                    out.flush()
                }
            }
            done.countDown()
        }
        thread.isDaemon = true
        thread.start()
        assertTrue("catalog server did not start", ready.await(1, TimeUnit.SECONDS))
        try {
            test("http://127.0.0.1:${server.localPort}", { requestedPath })
            assertTrue("catalog server did not receive request", done.await(1, TimeUnit.SECONDS))
        } finally {
            server.close()
        }
    }
}
