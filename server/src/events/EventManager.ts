type EventHandler = (context: any) => void;

export class EventManager {
  private handlers: Map<string, EventHandler[]> = new Map();

  on(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  handleEvent(eventType: string, context: any): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(context);
        } catch (error) {
          console.error(`❌ Error in event handler for ${eventType}:`, error);
        }
      });
    }
  }

  removeAllHandlers(eventType: string): void {
    this.handlers.delete(eventType);
  }
}
