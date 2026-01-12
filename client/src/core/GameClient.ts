type EventCallback = (data?: any) => void;

export class GameClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private eventHandlers: Map<string, EventCallback[]> = new Map();
  private connected: boolean = false;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  connect(): void {
    if (this.ws) {
      console.warn('Already connected or connecting');
      return;
    }

    this.ws = new WebSocket(this.serverUrl);

    this.ws.onopen = () => {
      console.log('✅ Connected to server');
      this.connected = true;
      this.emit('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit('message', data);
      } catch (error) {
        console.error('Failed to parse server message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('❌ Disconnected from server');
      this.connected = false;
      this.ws = null;
      this.emit('disconnected');
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', new Error('WebSocket connection error'));
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  send(data: any): void {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('Cannot send message: not connected');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  on(event: string, callback: EventCallback): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(callback);
  }

  private emit(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }
}
