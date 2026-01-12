import { WebSocketServer, WebSocket } from 'ws';
import { EventManager } from '../events/EventManager';
import { Player } from './Player';
import { City } from '../world/City';

export class GameServer {
  private wss: WebSocketServer | null = null;
  private eventManager: EventManager;
  private players: Map<string, Player> = new Map();
  private azuraCity: City;
  private port: number;

  constructor(port: number) {
    this.port = port;
    this.eventManager = new EventManager();
    this.azuraCity = new City('Azura');
  }

  start(): void {
    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('👤 New player connected');

      const playerId = this.generatePlayerId();
      const player = new Player(playerId, ws);
      this.players.set(playerId, player);

      // Send welcome message
      this.sendToPlayer(player, {
        type: 'welcome',
        playerId,
        city: this.azuraCity.getName(),
        message: `Welcome to ${this.azuraCity.getName()}!`
      });

      ws.on('message', (data: Buffer) => {
        this.handlePlayerMessage(player, data);
      });

      ws.on('close', () => {
        console.log(`👋 Player ${playerId} disconnected`);
        this.players.delete(playerId);
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for player ${playerId}:`, error);
      });
    });

    console.log(`✅ Game server listening on port ${this.port}`);
  }

  stop(): void {
    if (this.wss) {
      this.wss.close();
      console.log('✅ Server stopped');
    }
  }

  private handlePlayerMessage(player: Player, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      
      // Server-side validation of all player actions
      if (!this.validateMessage(message)) {
        console.warn(`⚠️ Invalid message from player ${player.getId()}`);
        return;
      }

      // Process through event manager
      this.eventManager.handleEvent(message.type, {
        player,
        data: message
      });
    } catch (error) {
      console.error('❌ Error parsing player message:', error);
    }
  }

  private validateMessage(message: any): boolean {
    // Anti-cheat: Basic message validation
    return message && typeof message.type === 'string';
  }

  private sendToPlayer(player: Player, data: any): void {
    const ws = player.getConnection();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  private generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
