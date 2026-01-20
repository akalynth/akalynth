Check if task requires custom agent delegation: $ARGUMENTS

Analysis steps:
1. Identify the task domain (protocol, anticheat, evidence, world, persistence)
2. Check for architectural constraints (see docs/COPILOT_DELEGATION.md)
3. Determine if task impacts:
   - Receipt schema or audit trail
   - WebSocket protocol messages
   - Anti-cheat detection patterns
   - Server-authoritative state
   - Civil Guarantees (G1-G15)

If YES to any above → Recommend specific custom agent
If NO → Can proceed without delegation

Return: Agent recommendation or "no delegation needed" with brief rationale
