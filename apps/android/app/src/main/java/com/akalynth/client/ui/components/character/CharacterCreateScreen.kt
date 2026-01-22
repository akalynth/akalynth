package com.akalynth.client.ui.components.character

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Character creation screen for new players.
 *
 * Maps to UI_REGRESSION_MATRIX.md Section 7: Character Creation (N1-N4).
 *
 * Contracts:
 * - N1: Name input field (max 16 chars, non-blank)
 * - N2: Sex selection (male/female toggle)
 * - N3: Sprite preview swaps on sex change
 * - N4: Create button enabled only when valid
 *
 * This is a pure presentation component with no navigation assumptions.
 * All actions are exposed via callbacks.
 *
 * @param onCreate Called with (name, sex) when create button is tapped and valid
 * @param modifier Optional modifier for the root container
 */
@Composable
fun CharacterCreateScreen(
    onCreate: (name: String, sex: CharacterSex) -> Unit,
    modifier: Modifier = Modifier
) {
    var name by remember { mutableStateOf("") }
    var selectedSex by remember { mutableStateOf(CharacterSex.MALE) }

    val isNameValid by remember {
        derivedStateOf {
            name.isNotBlank() && name.length <= MAX_NAME_LENGTH
        }
    }

    val isFormValid by remember {
        derivedStateOf { isNameValid }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF1A1A2E))
            .padding(24.dp)
            .testTag("CharacterCreateScreen"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Title
        Text(
            text = "Create Your Character",
            color = Color.White,
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.testTag("CharacterCreateScreen_Title")
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Sprite Preview
        SpritePreview(
            sex = selectedSex,
            modifier = Modifier.testTag("CharacterCreateScreen_Preview")
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Name Input
        NameInputField(
            name = name,
            onNameChange = { newName ->
                // Enforce max length at input level
                if (newName.length <= MAX_NAME_LENGTH) {
                    name = newName
                }
            },
            isValid = name.isEmpty() || isNameValid,
            modifier = Modifier
                .fillMaxWidth()
                .testTag("CharacterCreateScreen_NameInput")
        )

        // Character count indicator
        Text(
            text = "${name.length}/$MAX_NAME_LENGTH",
            color = if (name.length > MAX_NAME_LENGTH) Color.Red else Color.Gray,
            fontSize = 12.sp,
            modifier = Modifier
                .align(Alignment.End)
                .padding(top = 4.dp)
                .testTag("CharacterCreateScreen_CharCount")
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Sex Selection
        SexSelector(
            selectedSex = selectedSex,
            onSexSelected = { selectedSex = it },
            modifier = Modifier.testTag("CharacterCreateScreen_SexSelector")
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Create Button
        Button(
            onClick = {
                if (isFormValid) {
                    onCreate(name.trim(), selectedSex)
                }
            },
            enabled = isFormValid,
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF4CAF50),
                disabledContainerColor = Color(0xFF2E7D32).copy(alpha = 0.5f)
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .testTag("CharacterCreateScreen_CreateButton")
        ) {
            Text(
                text = "CREATE CHARACTER",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold
            )
        }

        // Validation hint
        if (name.isNotEmpty() && !isNameValid) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Name must be 1-$MAX_NAME_LENGTH characters",
                color = Color(0xFFFF5252),
                fontSize = 12.sp,
                modifier = Modifier.testTag("CharacterCreateScreen_ValidationHint")
            )
        }
    }
}

/**
 * Name input field with validation styling.
 */
@Composable
private fun NameInputField(
    name: String,
    onNameChange: (String) -> Unit,
    isValid: Boolean,
    modifier: Modifier = Modifier
) {
    OutlinedTextField(
        value = name,
        onValueChange = onNameChange,
        label = { Text("Character Name") },
        singleLine = true,
        isError = !isValid,
        keyboardOptions = KeyboardOptions(
            capitalization = KeyboardCapitalization.Words,
            imeAction = ImeAction.Done
        ),
        modifier = modifier.semantics {
            contentDescription = "Character name input"
        }
    )
}

/**
 * Sex selection toggle.
 */
@Composable
private fun SexSelector(
    selectedSex: CharacterSex,
    onSexSelected: (CharacterSex) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.Center
    ) {
        CharacterSex.entries.forEachIndexed { index, sex ->
            if (index > 0) {
                Spacer(modifier = Modifier.width(16.dp))
            }

            SexOption(
                sex = sex,
                isSelected = sex == selectedSex,
                onSelect = { onSexSelected(sex) },
                modifier = Modifier.testTag("CharacterCreateScreen_Sex_${sex.name}")
            )
        }
    }
}

/**
 * Individual sex option button.
 */
@Composable
private fun SexOption(
    sex: CharacterSex,
    isSelected: Boolean,
    onSelect: () -> Unit,
    modifier: Modifier = Modifier
) {
    val backgroundColor = if (isSelected) Color(0xFF3D5AFE) else Color(0xFF2A2A4A)
    val borderColor = if (isSelected) Color(0xFF536DFE) else Color.Transparent

    Box(
        modifier = modifier
            .size(width = 100.dp, height = 48.dp)
            .background(backgroundColor, RoundedCornerShape(8.dp))
            .border(2.dp, borderColor, RoundedCornerShape(8.dp))
            .clickable(onClick = onSelect),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = sex.displayName,
            color = Color.White,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
        )
    }
}

/**
 * Sprite preview placeholder.
 * Shows visual representation of character based on selected sex.
 */
@Composable
private fun SpritePreview(
    sex: CharacterSex,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .size(128.dp)
            .background(Color(0xFF2A2A4A), RoundedCornerShape(8.dp))
            .semantics {
                contentDescription = "${sex.displayName} character preview"
            },
        contentAlignment = Alignment.Center
    ) {
        // Placeholder sprite indicator
        // In production, this would load actual sprite assets
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = when (sex) {
                    CharacterSex.MALE -> "\uD83D\uDC68"  // Man emoji as placeholder
                    CharacterSex.FEMALE -> "\uD83D\uDC69"  // Woman emoji as placeholder
                },
                fontSize = 48.sp,
                modifier = Modifier.testTag("CharacterCreateScreen_SpriteIcon")
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = sex.spriteId,
                color = Color.Gray,
                fontSize = 10.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.testTag("CharacterCreateScreen_SpriteId")
            )
        }
    }
}

/**
 * Maximum character name length.
 */
const val MAX_NAME_LENGTH = 16
