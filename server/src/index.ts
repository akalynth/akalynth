import { GameServer } from './core/GameServer';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const server = new GameServer(PORT);

server.start();

console.log(`🎮 Akalynth Server starting on port ${PORT}`);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  server.stop();
  process.exit(0);
});
