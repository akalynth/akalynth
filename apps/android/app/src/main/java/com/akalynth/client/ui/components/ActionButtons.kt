package com.akalynth.client.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

@Composable
fun ActionButtons(
    onChat: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Color.Black.copy(alpha = 0.4f))
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Chat button
        Box(
            modifier = Modifier
                .size(56.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.8f))
                .clickable { onChat() },
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Email,
                contentDescription = "Chat",
                tint = Color.White,
                modifier = Modifier.size(28.dp)
            )
        }

        Text(
            text = "Chat",
            style = MaterialTheme.typography.labelSmall,
            color = Color.White
        )
    }
}
