# Akalynth Server

Authoritative game server for Akalynth MMO.

## Features

- **Server-authoritative**: All game logic runs on the server
- **Anti-cheat ready**: Server validates all client actions
- **Event-driven architecture**: Scalable event processing
- **WebSocket communication**: Real-time game updates

## Structure

```
src/
├── index.ts              # Server entry point
├── core/                 # Core game systems
│   ├── GameServer.ts     # Main server class
│   └── Player.ts         # Player entity
├── world/                # World and city management
│   └── City.ts           # City (Azura) logic
└── events/               # Game event handlers
    └── EventManager.ts   # Event coordination
```

## Getting Started

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Configuration

Server configuration is minimal by design:
- Port: 3000 (configurable via PORT env var)
- WebSocket endpoint: ws://localhost:3000

## Anti-cheat Architecture

- All player actions validated server-side
- State reconciliation for client predictions
- Event logging for audit trails
