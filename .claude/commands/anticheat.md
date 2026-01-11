Add a new anti-cheat signal: $ARGUMENTS

Requirements:
- Implement detector logic in apps/server/src/anticheat/detector.ts
- Add audit receipt emission for detection + enforcement decision
- Update docs/ANTICHEAT.md
- Keep server authoritative: client sends intent only
