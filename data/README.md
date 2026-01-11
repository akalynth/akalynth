# Data
Authoring inputs and runtime-ready game data.
Conventions:
- `*-src` = authoring output
- `*-built` = runtime-ready output
- Editors write to `data/*-src/`, compilers emit `data/*-built/`, runtime consumes only `*-built/`.
