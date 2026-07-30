# Codex Public-Graph Build Fallback

This directory contains an empty public Codex projection so a clean game-repo
checkout can compile without the separately governed `akalynth-codex`
repository or one of its generated artifacts.

The debug client uses this fallback only when no configured Codex root contains
`out/codex-public.graph.json`. A real generated public projection always takes
precedence.

The empty graph carries no lore, publication, acceptance, or canon claim.
