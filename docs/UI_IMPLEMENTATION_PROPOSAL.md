# Akalynth UI Implementation Proposal

**Status**: Draft
**Target**: Android Client (Primary) + Debug Client (Secondary)
**Baseline**: UI_PROPOSAL.md v0.3 (FROZEN)
**Date**: 2026-01-21

---

## Executive Summary

The v0 UI spec is frozen and well-defined. This document proposes the **implementation roadmap** to close the gap between spec and reality. The Android client is the primary target per platform policy.

### Current Gap Analysis

| Feature | Spec Status | Android | Debug Client |
|---------|-------------|---------|--------------|
| Thumb-zone layout | Defined | Partial | Partial |
| D-pad (8-dir) | Required | 4-dir only | 8-dir |
| Safety confirmations (T0-T3) | Required | None | None |
| Progressive disclosure | Required | None | Mock only |
| Character creation | Required | Placeholder | None |
| Death toast (L1) | Required | None | Partial |
| Death recap (L2) | Required | None | Implemented |
| Chronicle feed | Required | None | Implemented |
| Chat sheet | Required | Partial | Implemented |
| Inventory UI | Required | None | None |
| Tem challenge | Required | Implemented | Partial |
| Witness dialog | Required | Implemented | None |

---

## Phase 1: Core Layout Fixes (Android Priority)

### 1.1 Upgrade D-pad to 8-Direction

Current Android D-pad is 4-direction only. Spec requires 8-direction for diagonal movement.

```
     ┌─────────────────┐
     │     [NW][N][NE] │
     │     [W] [•] [E] │
     │     [SW][S][SE] │
     └─────────────────┘
```

**Implementation**:
```kotlin
// DPad.kt - Upgrade to 8-direction
@Composable
fun DPad(
    modifier: Modifier = Modifier,
    onDirection: (Direction) -> Unit,
    onRelease: () -> Unit = {}
) {
    val buttonSize = 44.dp  // Minimum hitbox per spec

    Column(modifier = modifier) {
        // Row 1: NW, N, NE
        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            DirectionButton("↖", Direction.NORTHWEST, buttonSize, onDirection)
            DirectionButton("↑", Direction.NORTH, buttonSize, onDirection)
            DirectionButton("↗", Direction.NORTHEAST, buttonSize, onDirection)
        }
        // Row 2: W, Center, E
        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            DirectionButton("←", Direction.WEST, buttonSize, onDirection)
            Spacer(Modifier.size(buttonSize))  // Dead center
            DirectionButton("→", Direction.EAST, buttonSize, onDirection)
        }
        // Row 3: SW, S, SE
        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            DirectionButton("↙", Direction.SOUTHWEST, buttonSize, onDirection)
            DirectionButton("↓", Direction.SOUTH, buttonSize, onDirection)
            DirectionButton("↘", Direction.SOUTHEAST, buttonSize, onDirection)
        }
    }
}
```

### 1.2 Enforce Dead Zone

Spec requires ≥100px between D-pad and action buttons.

```kotlin
@Composable
fun GameHUD() {
    Box(modifier = Modifier.fillMaxSize()) {
        // Left thumb zone - D-pad
        DPad(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 16.dp, bottom = 32.dp)
        )

        // Dead zone enforcer - invisible spacer
        // Actions positioned with ≥100px gap

        // Right thumb zone - Actions
        ActionPanel(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 16.dp, bottom = 32.dp)
        )
    }
}
```

---

## Phase 2: Safety Confirmations

### 2.1 Tier 1 - Single Tap with Feedback

**Use case**: Attack button, use item, cast spell

```
┌─────────────────────────┐
│                         │
│    [ ⚔ ATTACK ]         │  ← Normal state
│                         │
└─────────────────────────┘
         ↓ TAP
┌─────────────────────────┐
│   ╔═══════════════╗     │
│   ║  ⚔ ATTACK    ║     │  ← Pressed state (scale 0.95)
│   ╚═══════════════╝     │
└─────────────────────────┘
         ↓ 300ms
┌─────────────────────────┐
│                         │
│    [ ⚔ ATTACK ]  ░░░    │  ← Cooldown indicator
│                  ███    │
└─────────────────────────┘
```

**Implementation**:
```kotlin
@Composable
fun Tier1Button(
    text: String,
    icon: ImageVector,
    cooldownMs: Long = 500,
    onClick: () -> Unit
) {
    var isPressed by remember { mutableStateOf(false) }
    var cooldownRemaining by remember { mutableStateOf(0f) }
    val scale by animateFloatAsState(if (isPressed) 0.95f else 1f)

    Box(
        modifier = Modifier
            .sizeIn(minWidth = 44.dp, minHeight = 44.dp)
            .scale(scale)
            .pointerInput(Unit) {
                detectTapGestures(
                    onPress = {
                        if (cooldownRemaining <= 0f) {
                            isPressed = true
                            tryAwaitRelease()
                            isPressed = false
                            onClick()
                            cooldownRemaining = 1f
                        }
                    }
                )
            }
    ) {
        // Button content + cooldown overlay
        Icon(icon, contentDescription = text)
        if (cooldownRemaining > 0f) {
            CooldownOverlay(progress = cooldownRemaining)
        }
    }

    // Cooldown timer
    LaunchedEffect(cooldownRemaining) {
        if (cooldownRemaining > 0f) {
            delay(16)  // ~60fps
            cooldownRemaining = (cooldownRemaining - 16f / cooldownMs).coerceAtLeast(0f)
        }
    }
}
```

### 2.2 Tier 2 - Hold to Confirm (1.5s)

**Use case**: Drop item, unequip

```
┌─────────────────────────────┐
│      Drop Iron Sword?       │
│                             │
│      ╭───────────────╮      │
│      │               │      │
│      │    ◯ HOLD     │      │  ← Initial state
│      │               │      │
│      ╰───────────────╯      │
│                             │
│    Release to cancel        │
└─────────────────────────────┘
           ↓ HOLDING (0.5s)
┌─────────────────────────────┐
│      Drop Iron Sword?       │
│                             │
│      ╭───────────────╮      │
│      │    ╭──╮       │      │
│      │    │▓▓│ HOLD  │      │  ← Ring filling (33%)
│      │    ╰──╯       │      │
│      ╰───────────────╯      │
│                             │
│    Release to cancel        │
└─────────────────────────────┘
           ↓ HOLDING (1.5s)
┌─────────────────────────────┐
│      Drop Iron Sword?       │
│                             │
│      ╭───────────────╮      │
│      │    ╭██╮       │      │
│      │    │██│ DONE  │      │  ← Ring complete
│      │    ╰██╯       │      │
│      ╰───────────────╯      │
│                             │
│         ✓ Dropped           │
└─────────────────────────────┘
```

**Implementation**:
```kotlin
@Composable
fun Tier2HoldButton(
    label: String,
    holdDurationMs: Long = 1500,
    onConfirm: () -> Unit,
    onCancel: () -> Unit = {}
) {
    var progress by remember { mutableStateOf(0f) }
    var isHolding by remember { mutableStateOf(false) }

    // Progress timer
    LaunchedEffect(isHolding) {
        if (isHolding) {
            val startTime = System.currentTimeMillis()
            while (isHolding && progress < 1f) {
                delay(16)
                progress = ((System.currentTimeMillis() - startTime) / holdDurationMs.toFloat())
                    .coerceIn(0f, 1f)
                if (progress >= 1f) {
                    onConfirm()
                    isHolding = false
                }
            }
        } else if (progress > 0f && progress < 1f) {
            onCancel()
            progress = 0f
        }
    }

    Box(
        modifier = Modifier
            .size(80.dp)
            .pointerInput(Unit) {
                detectTapGestures(
                    onPress = {
                        isHolding = true
                        val released = tryAwaitRelease()
                        isHolding = false
                    }
                )
            },
        contentAlignment = Alignment.Center
    ) {
        // Progress ring
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawArc(
                color = Color.Gold,
                startAngle = -90f,
                sweepAngle = 360f * progress,
                useCenter = false,
                style = Stroke(width = 4.dp.toPx())
            )
        }
        Text(if (progress >= 1f) "DONE" else "HOLD")
    }
}
```

### 2.3 Tier 3 - Slide to Confirm

**Use case**: Drop legendary, destroy item

```
┌───────────────────────────────────────────┐
│     ⚠ DROP LEGENDARY                      │
│                                           │
│     ⚔ Flame Sword                         │
│     Tier 3 • Heat: 5                      │
│                                           │
│     ┌─────────────────────────────┐       │
│     │ ▶ ═══════════════════ DROP │       │  ← Initial
│     └─────────────────────────────┘       │
│                                           │
│     Slide to confirm                      │
└───────────────────────────────────────────┘
                   ↓ SLIDING
┌───────────────────────────────────────────┐
│     ⚠ DROP LEGENDARY                      │
│                                           │
│     ⚔ Flame Sword                         │
│     Tier 3 • Heat: 5                      │
│                                           │
│     ┌─────────────────────────────┐       │
│     │ ════════▶═══════════ DROP  │       │  ← Mid-slide
│     └─────────────────────────────┘       │
│                                           │
│     Keep sliding...                       │
└───────────────────────────────────────────┘
                   ↓ COMPLETE
┌───────────────────────────────────────────┐
│     ⚠ DROP LEGENDARY                      │
│                                           │
│     ⚔ Flame Sword                         │
│     Tier 3 • Heat: 5                      │
│                                           │
│     ┌─────────────────────────────┐       │
│     │ ════════════════════▶ DROP │       │  ← Complete
│     └─────────────────────────────┘       │
│                                           │
│     ✓ Dropped                             │
└───────────────────────────────────────────┘
```

**Implementation**:
```kotlin
@Composable
fun Tier3SlideConfirm(
    itemName: String,
    itemRarity: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    var slideProgress by remember { mutableStateOf(0f) }
    val threshold = 0.9f  // Must slide 90% to confirm

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF1a1a2e), RoundedCornerShape(16.dp))
            .padding(24.dp)
    ) {
        // Header
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Warning, contentDescription = null, tint = Color.Yellow)
            Spacer(Modifier.width(8.dp))
            Text("DROP $itemRarity", color = Color.Yellow, fontWeight = FontWeight.Bold)
        }

        Spacer(Modifier.height(16.dp))

        // Item info
        Text("⚔ $itemName", fontSize = 18.sp, color = Color.White)

        Spacer(Modifier.height(24.dp))

        // Slide track
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .background(Color(0xFF0d0d1a), RoundedCornerShape(28.dp))
                .draggable(
                    orientation = Orientation.Horizontal,
                    state = rememberDraggableState { delta ->
                        slideProgress = (slideProgress + delta / 300f).coerceIn(0f, 1f)
                    },
                    onDragStopped = {
                        if (slideProgress >= threshold) {
                            onConfirm()
                        } else {
                            slideProgress = 0f  // Snap back
                        }
                    }
                )
        ) {
            // Track fill
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .fillMaxWidth(slideProgress)
                    .background(Color(0xFF4a4a6a), RoundedCornerShape(28.dp))
            )

            // Thumb
            Box(
                modifier = Modifier
                    .offset { IntOffset((slideProgress * 244).roundToInt().dp.roundToPx(), 0) }
                    .size(56.dp)
                    .background(Color.Gold, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.ChevronRight, contentDescription = "Slide", tint = Color.Black)
            }

            // Label
            Text(
                "DROP",
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .padding(end = 16.dp),
                color = Color.White.copy(alpha = 0.7f)
            )
        }

        Spacer(Modifier.height(8.dp))

        Text(
            if (slideProgress >= threshold) "Release to confirm" else "Slide to confirm",
            color = Color.White.copy(alpha = 0.5f),
            fontSize = 12.sp,
            modifier = Modifier.align(Alignment.CenterHorizontally)
        )
    }
}
```

---

## Phase 3: Progressive Disclosure

### 3.1 Unlock State Persistence

```kotlin
// UnlockState.kt
@Serializable
data class UnlockState(
    val hasEngagedCombat: Boolean = false,
    val hasPickedUpItem: Boolean = false,
    val hasDied: Boolean = false
) {
    val stage: Int get() = when {
        hasDied -> 3
        hasPickedUpItem -> 2
        hasEngagedCombat -> 1
        else -> 0
    }
}

// UnlockRepository.kt
class UnlockRepository(private val dataStore: DataStore<Preferences>) {
    private val UNLOCK_KEY = stringPreferencesKey("unlock_state")

    val unlockState: Flow<UnlockState> = dataStore.data
        .map { prefs ->
            prefs[UNLOCK_KEY]?.let { Json.decodeFromString(it) }
                ?: UnlockState()
        }

    suspend fun recordCombat() = update { it.copy(hasEngagedCombat = true) }
    suspend fun recordItemPickup() = update { it.copy(hasPickedUpItem = true) }
    suspend fun recordDeath() = update { it.copy(hasDied = true) }

    private suspend fun update(transform: (UnlockState) -> UnlockState) {
        dataStore.edit { prefs ->
            val current = prefs[UNLOCK_KEY]?.let { Json.decodeFromString<UnlockState>(it) }
                ?: UnlockState()
            prefs[UNLOCK_KEY] = Json.encodeToString(transform(current))
        }
    }
}
```

### 3.2 Stage-Gated Visibility

```kotlin
@Composable
fun GameHUD(stage: Int) {
    Box(modifier = Modifier.fillMaxSize()) {
        // Top bar - always visible, content varies by stage
        TopBar(
            showMenu = stage >= 1,
            showWhyButton = stage >= 2,
            showRepGold = stage >= 3,
            showNearbyPlayers = stage >= 3
        )

        // D-pad - always visible (Stage 0+)
        DPad(modifier = Modifier.align(Alignment.BottomStart))

        // Attack button - Stage 1+
        AnimatedVisibility(
            visible = stage >= 1,
            enter = fadeIn() + scaleIn(),
            modifier = Modifier.align(Alignment.BottomEnd)
        ) {
            AttackButton(onClick = { /* ... */ })
        }

        // Hotbar - Stage 2+
        AnimatedVisibility(
            visible = stage >= 2,
            enter = slideInVertically { it } + fadeIn(),
            modifier = Modifier.align(Alignment.BottomEnd).padding(bottom = 80.dp)
        ) {
            Hotbar(slots = 4)
        }
    }
}

@Composable
fun TopBar(
    showMenu: Boolean,
    showWhyButton: Boolean,
    showRepGold: Boolean,
    showNearbyPlayers: Boolean
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.Black.copy(alpha = 0.7f))
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Left section
        Row {
            if (showMenu) MenuButton()
            else Spacer(Modifier.width(44.dp))  // Reserved space
        }

        // Center section
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            HPBar()
            if (showRepGold) {
                Row {
                    RepDisplay()
                    Spacer(Modifier.width(16.dp))
                    GoldDisplay()
                }
            }
        }

        // Right section
        Row {
            if (showNearbyPlayers) NearbyPlayersChip()
            if (showWhyButton) WhyButton()
            else Spacer(Modifier.width(44.dp))  // Reserved space
        }
    }
}
```

---

## Phase 4: Death Experience

### 4.1 Death Toast (Level 1)

```
┌────────────────────────────────────────────┐
│  ☠ You died                                │
│  Lost: Flame Sword, 2 Rations              │
│                                            │
│  [TAP FOR DETAILS]                         │
└────────────────────────────────────────────┘
```

```kotlin
@Composable
fun DeathToast(
    deathNotice: DeathNotice,
    itemsLost: List<String>,
    onTap: () -> Unit,
    onDismiss: () -> Unit
) {
    var visible by remember { mutableStateOf(true) }

    // Auto-dismiss after 5 seconds
    LaunchedEffect(Unit) {
        delay(5000)
        visible = false
        delay(300)  // Animation time
        onDismiss()
    }

    AnimatedVisibility(
        visible = visible,
        enter = slideInVertically { -it } + fadeIn(),
        exit = slideOutVertically { -it } + fadeOut()
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
                .clickable { onTap() },
            colors = CardDefaults.cardColors(containerColor = Color(0xFF2d1b1b))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("☠", fontSize = 24.sp)
                    Spacer(Modifier.width(8.dp))
                    Text("You died", color = Color.White, fontWeight = FontWeight.Bold)
                }

                if (itemsLost.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Lost: ${itemsLost.joinToString(", ")}",
                        color = Color.White.copy(alpha = 0.8f),
                        fontSize = 14.sp
                    )
                }

                Spacer(Modifier.height(12.dp))
                Text(
                    "[TAP FOR DETAILS]",
                    color = Color.Gold,
                    fontSize = 12.sp,
                    modifier = Modifier.align(Alignment.CenterHorizontally)
                )
            }
        }
    }
}
```

### 4.2 Death Recap Sheet (Level 2)

```kotlin
@Composable
fun DeathRecapSheet(
    deathEvent: ChronicleEvent,
    onDismiss: () -> Unit,
    onCopyEventId: (String) -> Unit
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF11182b)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("DEATH RECAP", color = Color.White, fontWeight = FontWeight.Bold)
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = Color.White)
                }
            }

            Divider(color = Color.White.copy(alpha = 0.2f))
            Spacer(Modifier.height(16.dp))

            // Details
            val details = deathEvent.details
            RecapRow("Killed by", details["killer_name"]?.toString() ?: "Unknown")
            RecapRow("Location", "${deathEvent.zone} (${deathEvent.x}, ${deathEvent.y})")
            RecapRow("Time", formatTime(deathEvent.timestamp))

            Spacer(Modifier.height(16.dp))

            // Items lost
            val itemsLost = (details["items_lost"] as? List<*>)?.filterIsInstance<String>()
            if (!itemsLost.isNullOrEmpty()) {
                Text("ITEMS LOST (${itemsLost.size}):", color = Color.Red, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                itemsLost.forEach { item ->
                    Text("• $item", color = Color.White.copy(alpha = 0.9f))
                }
            }

            Spacer(Modifier.height(24.dp))

            // Copy event ID button
            OutlinedButton(
                onClick = { deathEvent.evidenceRef?.chronicleEventId?.let(onCopyEventId) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("COPY EVENT ID")
            }
        }
    }
}

@Composable
private fun RecapRow(label: String, value: String) {
    Row(modifier = Modifier.padding(vertical = 4.dp)) {
        Text("$label: ", color = Color.White.copy(alpha = 0.6f))
        Text(value, color = Color.White)
    }
}
```

---

## Phase 5: Chronicle Feed

```kotlin
@Composable
fun ChronicleSheet(
    events: List<ChronicleEvent>,
    hasMore: Boolean,
    onLoadMore: () -> Unit,
    onEventClick: (ChronicleEvent) -> Unit,
    onDismiss: () -> Unit
) {
    val groupedEvents = events.groupBy { it.timestamp.toLocalDate() }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF11182b)
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.8f)
                .padding(16.dp)
        ) {
            item {
                Text("MY CHRONICLE", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                Spacer(Modifier.height(16.dp))
            }

            groupedEvents.forEach { (date, dayEvents) ->
                item {
                    Text(
                        formatDateHeader(date),
                        color = Color.Gold,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.padding(vertical = 8.dp)
                    )
                }

                items(dayEvents) { event ->
                    ChronicleEventRow(
                        event = event,
                        onClick = { onEventClick(event) }
                    )
                }
            }

            if (hasMore) {
                item {
                    TextButton(
                        onClick = onLoadMore,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("[LOAD MORE]", color = Color.Gold)
                    }
                }
            }
        }
    }
}

@Composable
fun ChronicleEventRow(event: ChronicleEvent, onClick: () -> Unit) {
    val (icon, text) = when (event.kind) {
        "death" -> "☠" to "Died at ${event.zone} (${event.x}, ${event.y})"
        "item_pickup" -> "📦" to "Picked up ${event.details["item_type"]}"
        "zone_enter" -> "🏛" to "Entered ${event.zone}"
        "combat_kill" -> "⚔" to "Killed ${event.details["target_name"]}"
        "tutorial_complete" -> "🎓" to "Completed tutorial"
        "character_created" -> "✨" to "Character created"
        else -> "•" to event.kind
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = event.kind == "death") { onClick() }
            .padding(vertical = 8.dp, horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(formatTime(event.timestamp), color = Color.White.copy(alpha = 0.5f), fontSize = 12.sp)
        Spacer(Modifier.width(12.dp))
        Text(icon, fontSize = 16.sp)
        Spacer(Modifier.width(8.dp))
        Text(text, color = Color.White, fontSize = 14.sp)
    }
}
```

---

## Phase 6: Character Creation

```kotlin
@Composable
fun CharacterCreateScreen(
    onCharacterCreated: (name: String, sex: Sex) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var selectedSex by remember { mutableStateOf(Sex.MALE) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0b1020))
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("CREATE CHARACTER", color = Color.Gold, fontSize = 24.sp, fontWeight = FontWeight.Bold)

        Spacer(Modifier.height(48.dp))

        // Character preview
        Box(
            modifier = Modifier
                .size(128.dp)
                .background(Color(0xFF11182b), RoundedCornerShape(16.dp)),
            contentAlignment = Alignment.Center
        ) {
            // Sprite preview based on selected sex
            CharacterSprite(sex = selectedSex, size = 96.dp)
        }

        Spacer(Modifier.height(32.dp))

        // Name input
        OutlinedTextField(
            value = name,
            onValueChange = { name = it.take(16) },
            label = { Text("Name") },
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Color.Gold,
                unfocusedBorderColor = Color.White.copy(alpha = 0.3f),
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White
            ),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(Modifier.height(24.dp))

        // Sex selection
        Text("Sex:", color = Color.White.copy(alpha = 0.7f))
        Spacer(Modifier.height(8.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
            SexOption(
                label = "Male",
                selected = selectedSex == Sex.MALE,
                onClick = { selectedSex = Sex.MALE }
            )
            SexOption(
                label = "Female",
                selected = selectedSex == Sex.FEMALE,
                onClick = { selectedSex = Sex.FEMALE }
            )
        }

        Spacer(Modifier.height(48.dp))

        // Create button
        Button(
            onClick = { onCharacterCreated(name, selectedSex) },
            enabled = name.isNotBlank(),
            colors = ButtonDefaults.buttonColors(containerColor = Color.Gold),
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
        ) {
            Text("CREATE", color = Color.Black, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun SexOption(label: String, selected: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier.clickable { onClick() },
        verticalAlignment = Alignment.CenterVertically
    ) {
        RadioButton(
            selected = selected,
            onClick = onClick,
            colors = RadioButtonDefaults.colors(selectedColor = Color.Gold)
        )
        Spacer(Modifier.width(4.dp))
        Text(label, color = Color.White)
    }
}
```

---

## Phase 7: Inventory UI

### 7.1 Hotbar (4 slots)

```
┌────────────────────────────┐
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐
│  │ 🍖 │ │ 🧪 │ │ ⚔️ │ │    │   ← 4 slots, 48x48px each
│  └────┘ └────┘ └────┘ └────┘
└────────────────────────────┘
```

```kotlin
@Composable
fun Hotbar(
    slots: List<Item?>,
    onSlotTap: (Int) -> Unit,
    onSlotLongPress: (Int) -> Unit  // Opens drop confirmation
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(10.dp)  // Min 10px per spec
    ) {
        slots.forEachIndexed { index, item ->
            HotbarSlot(
                item = item,
                slotNumber = index + 1,
                onTap = { onSlotTap(index) },
                onLongPress = { onSlotLongPress(index) }
            )
        }
    }
}

@Composable
fun HotbarSlot(
    item: Item?,
    slotNumber: Int,
    onTap: () -> Unit,
    onLongPress: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(48.dp)
            .background(Color(0xFF11182b), RoundedCornerShape(8.dp))
            .border(1.dp, Color.Gold.copy(alpha = 0.3f), RoundedCornerShape(8.dp))
            .pointerInput(Unit) {
                detectTapGestures(
                    onTap = { onTap() },
                    onLongPress = { onLongPress() }
                )
            },
        contentAlignment = Alignment.Center
    ) {
        if (item != null) {
            ItemIcon(item = item, size = 32.dp)

            // Stack count
            if (item.stackCount > 1) {
                Text(
                    "${item.stackCount}",
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(2.dp),
                    color = Color.White,
                    fontSize = 10.sp
                )
            }
        } else {
            Text("$slotNumber", color = Color.White.copy(alpha = 0.3f), fontSize = 12.sp)
        }
    }
}
```

---

## Implementation Priority

### Sprint 1 (Core Safety)
1. [ ] Tier 2 hold-to-confirm for item drops
2. [ ] Tier 3 slide-to-confirm for legendary drops
3. [ ] Progressive disclosure persistence (DataStore)
4. [ ] D-pad upgrade to 8-direction

### Sprint 2 (Death Experience)
1. [ ] Death toast (Level 1)
2. [ ] Death recap sheet (Level 2)
3. [ ] Chronicle feed integration
4. [ ] "Copy Event ID" functionality

### Sprint 3 (Character & Items)
1. [ ] Character creation screen
2. [ ] Sex selection with sprite preview
3. [ ] Hotbar UI (4 slots)
4. [ ] Basic inventory management

### Sprint 4 (Polish)
1. [ ] Stage-gated visibility animations
2. [ ] Top bar with Rep/Gold (Stage 3)
3. [ ] Nearby players chip
4. [ ] "Why?" button integration

---

## Visual Design Tokens

### Colors

```kotlin
object AkalynthColors {
    // Backgrounds
    val Background = Color(0xFF0b1020)
    val Surface = Color(0xFF11182b)
    val SurfaceVariant = Color(0xFF1a1a2e)

    // Accent
    val Gold = Color(0xFFe2b714)
    val GoldDark = Color(0xFFb8940f)

    // Text
    val TextPrimary = Color(0xFFe5e7eb)
    val TextSecondary = Color(0xFFa0a0a0)

    // Status
    val Danger = Color(0xFFef4444)
    val Warning = Color(0xFFf59e0b)
    val Success = Color(0xFF22c55e)

    // Health
    val HealthFull = Color(0xFF22c55e)
    val HealthMid = Color(0xFFf59e0b)
    val HealthLow = Color(0xFFef4444)
}
```

### Typography

```kotlin
object AkalynthTypography {
    val Header = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Bold,
        fontSize = 20.sp,
        color = AkalynthColors.Gold
    )

    val Body = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        color = AkalynthColors.TextPrimary
    )

    val Caption = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        color = AkalynthColors.TextSecondary
    )

    val Button = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Bold,
        fontSize = 14.sp,
        letterSpacing = 0.5.sp
    )
}
```

### Spacing & Sizing

```kotlin
object AkalynthDimensions {
    val MinHitbox = 44.dp        // Per spec
    val HotbarSlot = 48.dp       // Per spec
    val DeadZone = 100.dp        // Per spec
    val SlotGap = 10.dp          // Per spec

    val PaddingSmall = 8.dp
    val PaddingMedium = 16.dp
    val PaddingLarge = 24.dp

    val BorderRadius = 8.dp
    val CardRadius = 16.dp
}
```

---

## Verification Checklist

After implementation, verify against UI_PROPOSAL.md v0.3:

- [ ] D-pad on left, actions on right
- [ ] ≥100px gap between D-pad and any action button
- [ ] All hitboxes ≥44px
- [ ] Movement is instant (Tier 0)
- [ ] Attack is single-tap with cooldown (Tier 1)
- [ ] Drop item requires 1.5s hold (Tier 2)
- [ ] Drop legendary requires slide (Tier 3)
- [ ] Release during hold cancels action
- [ ] New player sees only D-pad + HP + Chat
- [ ] Attack button appears after first combat
- [ ] Hotbar appears after first item pickup
- [ ] Rep/Gold appear after first death
- [ ] Unlock state persists across sessions
- [ ] Death toast appears within 500ms of death
- [ ] Toast shows items lost
- [ ] Tap expands to recap sheet
- [ ] Chronicle shows events grouped by day
- [ ] Sex selection at character creation
- [ ] Starter outfit auto-assigned

---

*Document version: 1.0*
*Last updated: 2026-01-21*
*Related: UI_PROPOSAL.md (frozen spec), EVIDENCE_UI_SPEC.md (v1 forensics)*
