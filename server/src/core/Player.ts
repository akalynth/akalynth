import { WebSocket } from 'ws';

export class Player {
  private id: string;
  private connection: WebSocket;
  private lastActionTime: number = Date.now();

  constructor(id: string, connection: WebSocket) {
    this.id = id;
    this.connection = connection;
  }

  getId(): string {
    return this.id;
  }

  getConnection(): WebSocket {
    return this.connection;
  }

  updateLastAction(): void {
    this.lastActionTime = Date.now();
  }

  getLastActionTime(): number {
    return this.lastActionTime;
  }
}
