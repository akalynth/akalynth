package com.akalynth.client.rules

import org.junit.Assert.*
import org.junit.Test

/**
 * Tests for RuleRegistry integrity.
 *
 * Ensures:
 * - Every RuleId has a registry entry
 * - No duplicate IDs
 * - All definitions are valid
 */
class RuleRegistryTest {

    // =========================================================================
    // Completeness: Every RuleId has a registry entry
    // =========================================================================

    @Test
    fun `every RuleId constant has a registry entry`() {
        val missing = RuleId.ALL.filter { !RuleRegistry.contains(it) }

        assertTrue(
            "Missing registry entries for: $missing",
            missing.isEmpty()
        )
    }

    @Test
    fun `registry contains all RuleId constants`() {
        assertEquals(RuleId.ALL.size, RuleRegistry.allIds().size)
    }

    // =========================================================================
    // No duplicates
    // =========================================================================

    @Test
    fun `RuleId ALL has no duplicates`() {
        val ids = RuleId.ALL.toList()
        val unique = ids.toSet()

        assertEquals(
            "Duplicate IDs found: ${ids.groupBy { it }.filter { it.value.size > 1 }.keys}",
            ids.size,
            unique.size
        )
    }

    @Test
    fun `registry has no duplicate entries`() {
        val allIds = RuleRegistry.allIds().toList()
        val unique = allIds.toSet()

        assertEquals(allIds.size, unique.size)
    }

    // =========================================================================
    // Definition validity
    // =========================================================================

    @Test
    fun `all definitions have matching ID in key and value`() {
        RuleRegistry.all().forEach { def ->
            assertEquals(
                "Definition ID mismatch for ${def.id}",
                def.id,
                RuleRegistry.get(def.id)?.id
            )
        }
    }

    @Test
    fun `all definitions have non-blank title`() {
        RuleRegistry.all().forEach { def ->
            assertTrue(
                "Rule ${def.id} has blank title",
                def.title.isNotBlank()
            )
        }
    }

    @Test
    fun `all definitions have non-blank description`() {
        RuleRegistry.all().forEach { def ->
            assertTrue(
                "Rule ${def.id} has blank description",
                def.description.isNotBlank()
            )
        }
    }

    // =========================================================================
    // Lookup functions
    // =========================================================================

    @Test
    fun `get returns definition for valid ID`() {
        val def = RuleRegistry.get(RuleId.TIER2_HOLD_REQUIRED_FOR_ITEM_DROP)
        assertNotNull(def)
        assertEquals("Hold to Drop", def?.title)
    }

    @Test
    fun `get returns null for invalid ID`() {
        val def = RuleRegistry.get("INVALID_RULE_ID")
        assertNull(def)
    }

    @Test
    fun `require returns definition for valid ID`() {
        val def = RuleRegistry.require(RuleId.DEATH_ITEMS_LOST_ON_DEATH)
        assertEquals("Items Lost", def.title)
    }

    @Test
    fun `require throws for invalid ID`() {
        assertThrows(IllegalArgumentException::class.java) {
            RuleRegistry.require("INVALID_RULE_ID")
        }
    }

    @Test
    fun `contains returns true for valid ID`() {
        assertTrue(RuleRegistry.contains(RuleId.STAGE_ATTACK_UNLOCKED_AFTER_COMBAT))
    }

    @Test
    fun `contains returns false for invalid ID`() {
        assertFalse(RuleRegistry.contains("INVALID_RULE_ID"))
    }

    // =========================================================================
    // Query functions
    // =========================================================================

    @Test
    fun `bySeverity returns correct rules`() {
        val enforcement = RuleRegistry.bySeverity(RuleSeverity.ENFORCEMENT)

        assertTrue(enforcement.isNotEmpty())
        assertTrue(enforcement.all { it.severity == RuleSeverity.ENFORCEMENT })
    }

    @Test
    fun `byDomain returns rules with matching prefix`() {
        val stageRules = RuleRegistry.byDomain("STAGE_")
        val tierRules = RuleRegistry.byDomain("TIER")
        val deathRules = RuleRegistry.byDomain("DEATH_")

        assertTrue(stageRules.isNotEmpty())
        assertTrue(tierRules.isNotEmpty())
        assertTrue(deathRules.isNotEmpty())

        assertTrue(stageRules.all { it.id.startsWith("STAGE_") })
        assertTrue(deathRules.all { it.id.startsWith("DEATH_") })
    }

    // =========================================================================
    // Domain coverage
    // =========================================================================

    @Test
    fun `stage domain has rules`() {
        val rules = RuleRegistry.byDomain("STAGE_")
        assertTrue("Stage domain should have rules", rules.size >= 5)
    }

    @Test
    fun `tier domain has rules`() {
        val rules = RuleRegistry.byDomain("TIER")
        assertTrue("Tier domain should have rules", rules.size >= 4)
    }

    @Test
    fun `overlay domain has rules`() {
        val rules = RuleRegistry.byDomain("OVERLAY_")
        assertTrue("Overlay domain should have rules", rules.size >= 4)
    }

    @Test
    fun `receipt domain has rules`() {
        val rules = RuleRegistry.byDomain("RECEIPT_")
        assertTrue("Receipt domain should have rules", rules.size >= 5)
    }

    @Test
    fun `death domain has rules`() {
        val rules = RuleRegistry.byDomain("DEATH_")
        assertTrue("Death domain should have rules", rules.size >= 3)
    }

    @Test
    fun `drop domain has rules`() {
        val rules = RuleRegistry.byDomain("DROP_")
        assertTrue("Drop domain should have rules", rules.size >= 5)
    }

    // =========================================================================
    // Specific rule checks
    // =========================================================================

    @Test
    fun `tier2 hold rule has remediation`() {
        val rule = RuleRegistry.require(RuleId.TIER2_HOLD_REQUIRED_FOR_ITEM_DROP)
        assertNotNull(rule.remediation)
    }

    @Test
    fun `tier3 slide rule has warning severity`() {
        val rule = RuleRegistry.require(RuleId.TIER3_SLIDE_REQUIRED_FOR_LEGENDARY_DROP)
        assertEquals(RuleSeverity.WARNING, rule.severity)
    }

    @Test
    fun `enforcement rules exist`() {
        val enforcement = RuleRegistry.bySeverity(RuleSeverity.ENFORCEMENT)
        assertTrue(
            "Should have enforcement rules",
            enforcement.any { it.id == RuleId.STAGE_ACTION_BLOCKED_IN_EARLY_STAGE }
        )
    }

    @Test
    fun `receipt confirmed is INFO severity`() {
        val rule = RuleRegistry.require(RuleId.RECEIPT_CONFIRMED_BY_SERVER)
        assertEquals(RuleSeverity.INFO, rule.severity)
    }

    @Test
    fun `receipt rejected is ENFORCEMENT severity`() {
        val rule = RuleRegistry.require(RuleId.RECEIPT_REJECTED_BY_SERVER)
        assertEquals(RuleSeverity.ENFORCEMENT, rule.severity)
    }
}
