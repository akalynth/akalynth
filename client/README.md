# Akalynth Client

Web and mobile-friendly client for Akalynth MMO.

## Features

- **Web-based**: Runs in any modern browser
- **Mobile-friendly**: Responsive design
- **WebSocket communication**: Real-time updates
- **Lightweight**: Minimal dependencies

## Structure

```
src/
├── main.ts               # Client entry point
└── core/
    └── GameClient.ts     # WebSocket client class

public/                   # Static assets
index.html                # Main HTML file
```

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Configuration

Set the server URL via environment variable:

```bash
VITE_SERVER_URL=ws://your-server:3000 npm run dev
```

Default: `ws://localhost:3000`

## Development

The client connects to the game server via WebSocket. Once connected, it can send and receive game events in real-time.

The current prototype displays:
- Connection status
- Welcome message from Azura city
- Message log
