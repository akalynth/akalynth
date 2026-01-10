export class City {
  private name: string;
  private playerCount: number = 0;

  constructor(name: string) {
    this.name = name;
  }

  getName(): string {
    return this.name;
  }

  addPlayer(): void {
    this.playerCount++;
  }

  removePlayer(): void {
    if (this.playerCount > 0) {
      this.playerCount--;
    }
  }

  getPlayerCount(): number {
    return this.playerCount;
  }
}
