package com.akalynth.client.network

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

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
}
