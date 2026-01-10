# Akalynth Documentation

Practical documentation for the Akalynth MMO prototype.

## Overview

Akalynth is a social-first, low-grind MMO with a focus on player interaction and fun gameplay. The current prototype establishes the foundation for a server-authoritative, anti-cheat-ready game architecture.

## Architecture

### Server-Authoritative Model

All game logic runs on the server to prevent cheating:
- Server validates every player action
- Client sends inputs, server responds with state updates
- State reconciliation for smooth client predictions

### Anti-Cheat Strategy

Built-in from the start:
- Input validation on every message
- Rate limiting (planned)
- Action timestamp tracking
- Server-side physics and collision (planned)

## World Design

### City: Azura

The first and currently only city in Akalynth:
- Central hub for player activity
- Social gathering space
- Quest and event origin point

### Future Expansion

- Multiple cities with unique themes
- Travel between cities
- City-specific events and activities

## Technical Stack

### Server
- **Runtime**: Node.js
- **Language**: TypeScript
- **Communication**: WebSocket (ws library)
- **Architecture**: Event-driven

### Client
- **Framework**: Vanilla TypeScript + Vite
- **Communication**: WebSocket API
- **Target**: Web and mobile browsers

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/VaultSovereign/akalynth.git
   cd akalynth
   ```

2. **Install server dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Install client dependencies**
   ```bash
   cd ../client
   npm install
   ```

### Running Locally

1. **Start the server**
   ```bash
   cd server
   npm run dev
   ```
   Server runs on `ws://localhost:3000`

2. **Start the client** (in a new terminal)
   ```bash
   cd client
   npm run dev
   ```
   Client runs on `http://localhost:5173`

3. **Open your browser** to `http://localhost:5173` and click "Connect to Server"

## Development Workflow

### Adding Game Features

1. **Define the event** in server's EventManager
2. **Implement server logic** with validation
3. **Update client** to send/receive events
4. **Test** the feature locally

### Code Organization

```
/server
  /src
    /core       # Game server, player management
    /world      # Cities, zones, locations
    /events     # Event handling system
    index.ts    # Entry point

/client
  /src
    /core       # Client connection logic
    main.ts     # Entry point
  index.html    # UI

/docs
  README.md     # This file
```

## Best Practices

1. **Server validates everything**: Never trust client input
2. **Keep state on server**: Client only displays what server sends
3. **Log important events**: For debugging and anti-cheat audit trails
4. **Fail gracefully**: Handle disconnects and errors elegantly

## Roadmap

### Phase 1: Foundation (Current)
- [x] Mono-repo structure
- [x] Server scaffolding
- [x] Client scaffolding
- [x] WebSocket communication
- [x] Basic event system
- [x] City concept (Azura)

### Phase 2: Core Gameplay (Next)
- [ ] Player movement in Azura
- [ ] Player-to-player chat
- [ ] Simple interaction system
- [ ] Player presence/status

### Phase 3: Social Features
- [ ] Parties/groups
- [ ] Friend system
- [ ] Player profiles
- [ ] Social spaces in Azura

### Phase 4: Content
- [ ] Quest system
- [ ] Events and activities
- [ ] Rewards and progression
- [ ] Multiple cities

## Contributing

Keep changes minimal and focused. Follow the existing code style. Test thoroughly before submitting.

## License

ISC
