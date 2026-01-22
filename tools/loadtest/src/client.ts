/**
 * Load Test WebSocket Client
 *
 * A WebSocket client with think-time support, deterministic randomness,
 * and rate limiting for realistic load simulation.
 */

import WebSocket from 'ws';
import { MetricsCollector } from './metrics.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ClientConfig {
  id: number;
  serverAddr: string;
  seed: number;
  maxMsgPerSec: number;
  verbose?: boolean;
}

export interface ClientState {
  connected: boolean;
  authenticated: boolean;
  inWorld: boolean;
  playerId?: string;
  playerName?: string;
  x: number;
  y: number;
  pendingTem?: { challenge_id: string; answer: string };
}

export type ActionType =
  | 'move_intent'
  | 'chat'
  | 'idle'
  | 'logout'
  | 'enter_world';

export interface ClientAction {
  type: ActionType;
  data?: Record<string, unknown>;
}

type MessageHandler = (msg: Record<string, unknown>) => void;

// -----------------------------------------------------------------------------
// Seeded Random Number Generator (for reproducibility)
// -----------------------------------------------------------------------------

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    // Mulberry32
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

// -----------------------------------------------------------------------------
// Load Test Client
// -----------------------------------------------------------------------------

export class LoadTestClient {
  private config: ClientConfig;
  private ws: WebSocket | null = null;
  private state: ClientState;
  private rng: SeededRandom;
  private metrics: MetricsCollector;
  private messageHandlers: MessageHandler[] = [];
  private lastSendTime = 0;
  private sendCount = 0;
  private pendingMessages: Map<string, { sentAt: number }> = new Map();
  private connectionPromise: Promise<void> | null = null;
  private reconnecting = false;

  constructor(config: ClientConfig, metrics: MetricsCollector) {
    this.config = config;
    this.rng = new SeededRandom(config.seed + config.id);
    this.metrics = metrics;
    this.state = {
      connected: false,
      authenticated: false,
      inWorld: false,
      x: 0,
      y: 0,
    };
  }

  async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.serverAddr);

        this.ws.on('open', () => {
          this.state.connected = true;
          this.log('Connected');
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            this.handleMessage(msg);
          } catch {
            // Ignore parse errors
          }
        });

        this.ws.on('close', () => {
          this.state.connected = false;
          this.state.authenticated = false;
          this.state.inWorld = false;
          this.metrics.recordDisconnect();
          this.log('Disconnected');
        });

        this.ws.on('error', (err) => {
          this.metrics.recordError();
          this.log(`Error: ${err.message}`);
          reject(err);
        });

        // Connection timeout
        setTimeout(() => {
          if (!this.state.connected) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      } catch (err) {
        reject(err);
      }
    });

    return this.connectionPromise;
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.state.connected = false;
    this.state.authenticated = false;
    this.state.inWorld = false;
    this.connectionPromise = null;
  }

  async reconnect(): Promise<void> {
    if (this.reconnecting) return;
    this.reconnecting = true;

    await this.disconnect();
    await this.sleep(this.rng.nextInt(500, 2000));
    await this.connect();
    await this.login();
    await this.enterWorld();

    this.reconnecting = false;
  }

  async login(): Promise<void> {
    if (!this.state.connected) {
      throw new Error('Not connected');
    }

    const name = `loadtest_${this.config.id}_${this.rng.nextInt(1000, 9999)}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Login timeout'));
      }, 10000);

      const handler: MessageHandler = (msg) => {
        if (msg.type === 'login_ack') {
          clearTimeout(timeout);
          this.state.authenticated = true;
          this.state.playerId = msg.player_id as string;
          this.state.playerName = name;
          this.removeHandler(handler);
          this.log(`Logged in as ${this.state.playerId}`);
          resolve();
        } else if (msg.type === 'error') {
          clearTimeout(timeout);
          this.removeHandler(handler);
          reject(new Error(`Login error: ${msg.message}`));
        }
      };

      this.addHandler(handler);
      this.send({ type: 'login', name });
    });
  }

  async enterWorld(map: string = 'rookguard'): Promise<void> {
    if (!this.state.authenticated) {
      throw new Error('Not authenticated');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Enter world timeout'));
      }, 10000);

      const handler: MessageHandler = (msg) => {
        if (msg.type === 'world_state') {
          clearTimeout(timeout);
          this.state.inWorld = true;
          const me = (msg.players as Array<{ id: string; x: number; y: number }>)?.find(
            (p) => p.id === this.state.playerId
          );
          if (me) {
            this.state.x = me.x;
            this.state.y = me.y;
          }
          this.removeHandler(handler);
          this.log(`Entered world at (${this.state.x}, ${this.state.y})`);
          resolve();
        } else if (msg.type === 'error') {
          clearTimeout(timeout);
          this.removeHandler(handler);
          reject(new Error(`Enter world error: ${msg.message}`));
        }
      };

      this.addHandler(handler);
      this.send({ type: 'enter_world', map });
    });
  }

  async performAction(action: ClientAction): Promise<void> {
    if (!this.state.inWorld && action.type !== 'enter_world') {
      return; // Skip if not in world
    }

    // Rate limiting
    const now = Date.now();
    const minInterval = 1000 / this.config.maxMsgPerSec;
    const elapsed = now - this.lastSendTime;
    if (elapsed < minInterval) {
      await this.sleep(minInterval - elapsed);
    }

    switch (action.type) {
      case 'move_intent':
        await this.move();
        break;
      case 'chat':
        await this.chat();
        break;
      case 'idle':
        // Do nothing (think time handled by scenario)
        break;
      case 'logout':
        await this.disconnect();
        break;
      case 'enter_world':
        await this.enterWorld();
        break;
    }
  }

  private async move(): Promise<void> {
    const directions = ['north', 'south', 'east', 'west'] as const;
    const direction = this.rng.pick([...directions]);
    const msgId = `${this.config.id}-${this.sendCount}`;

    this.pendingMessages.set(msgId, { sentAt: Date.now() });
    this.send({ type: 'move_intent', direction });

    // Track move result
    const handler: MessageHandler = (msg) => {
      if (msg.type === 'move_result') {
        const pending = this.pendingMessages.get(msgId);
        if (pending) {
          const latency = Date.now() - pending.sentAt;
          this.metrics.recordMessageLatency(latency);
          this.pendingMessages.delete(msgId);
        }

        if (msg.ok) {
          this.state.x = msg.x as number;
          this.state.y = msg.y as number;
        }
        this.removeHandler(handler);
      }
    };

    this.addHandler(handler);

    // Clean up handler after timeout
    setTimeout(() => {
      this.removeHandler(handler);
      this.pendingMessages.delete(msgId);
    }, 5000);
  }

  private async chat(): Promise<void> {
    const messages = [
      'Hello!',
      'Testing load...',
      `Client ${this.config.id} here`,
      'How is the server holding up?',
      'Just passing through',
    ];
    const message = this.rng.pick(messages);
    this.send({ type: 'chat', message });
  }

  private handleMessage(msg: Record<string, unknown>): void {
    this.metrics.recordMessageReceived();

    // Handle TEM challenges automatically
    if (msg.type === 'tem_challenge') {
      this.handleTemChallenge(msg);
      return;
    }

    // Update position from broadcasts
    if (msg.type === 'player_moved' && msg.player_id === this.state.playerId) {
      this.state.x = msg.x as number;
      this.state.y = msg.y as number;
    }

    // Call registered handlers
    for (const handler of this.messageHandlers) {
      handler(msg);
    }
  }

  private handleTemChallenge(msg: Record<string, unknown>): void {
    this.log('Received TEM challenge');

    // For load testing, we simulate a human-like response time
    const responseDelay = this.rng.nextInt(500, 2000);

    setTimeout(() => {
      // Simple TEM challenge solving (assumes arithmetic challenges)
      const challengeId = msg.challenge_id as string;
      const question = msg.question as string;

      let answer: string;
      try {
        // Try to parse simple arithmetic like "5 + 3"
        const match = question.match(/(\d+)\s*([+\-*])\s*(\d+)/);
        if (match) {
          const a = parseInt(match[1], 10);
          const op = match[2];
          const b = parseInt(match[3], 10);
          let result: number;
          switch (op) {
            case '+':
              result = a + b;
              break;
            case '-':
              result = a - b;
              break;
            case '*':
              result = a * b;
              break;
            default:
              result = 0;
          }
          answer = result.toString();
        } else {
          answer = 'unknown';
        }
      } catch {
        answer = 'unknown';
      }

      this.send({ type: 'tem_response', challenge_id: challengeId, answer });
      this.log(`Responded to TEM challenge: ${answer}`);
    }, responseDelay);
  }

  private send(msg: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(JSON.stringify(msg));
    this.metrics.recordMessageSent();
    this.lastSendTime = Date.now();
    this.sendCount++;
  }

  private addHandler(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  private removeHandler(handler: MessageHandler): void {
    const idx = this.messageHandlers.indexOf(handler);
    if (idx >= 0) {
      this.messageHandlers.splice(idx, 1);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[Client ${this.config.id}] ${message}`);
    }
  }

  getState(): ClientState {
    return { ...this.state };
  }

  isConnected(): boolean {
    return this.state.connected;
  }

  isInWorld(): boolean {
    return this.state.inWorld;
  }
}
