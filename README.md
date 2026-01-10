# 🎮 Akalynth

> A social-first, low-grind MMO prototype focused on fun and player interaction

## Vision

Akalynth is an **online-first MMO** designed to be **fun, social, and free from grinding**. Set in a city-based world starting with **Azura**, the game prioritizes meaningful player interactions over repetitive tasks.

**Core Principles:**
- **Social-first**: Built for player interaction and collaboration
- **Low grind**: Respect players' time with engaging, not repetitive, gameplay
- **Server-authoritative**: All game logic runs on the server for fairness
- **Anti-cheat ready**: Architecture designed to prevent cheating from day one
- **Simple and shippable**: Clean, maintainable code that can evolve

## Architecture

This is a **mono-repo** containing:

- **`/server`** - Authoritative game server with WebSocket communication
  - Event-driven architecture
  - Anti-cheat hooks and validation
  - City management (Azura)
  
- **`/client`** - Web and mobile-friendly game client
  - Real-time WebSocket connection
  - Lightweight vanilla TypeScript
  
- **`/docs`** - Practical documentation
  - Architecture overview
  - Development guides
  - Roadmap

## Quick Start

**Prerequisites**: Node.js 18+

```bash
# 1. Start the server
cd server
npm install
npm run dev

# 2. Start the client (in another terminal)
cd client
npm install
npm run dev

# 3. Open http://localhost:5173 in your browser
```

## Current Status

**Phase 1: Foundation** ✅
- Clean mono-repo structure
- Server scaffolding with WebSocket support
- Client scaffolding with connection UI
- Basic event system
- City concept (Azura)
- Documentation

**Next: Phase 2 - Core Gameplay**
- Player movement
- Real-time chat
- Presence system

## Technology

- **Server**: Node.js + TypeScript + WebSocket
- **Client**: Vite + TypeScript + WebSocket API
- **World**: City-based (starting with Azura)

## Development

See [/docs](./docs/README.md) for detailed documentation including:
- Architecture deep-dive
- Anti-cheat strategy
- Development workflow
- Contributing guidelines

## License

ISC