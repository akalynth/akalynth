import { GameClient } from './core/GameClient';

const statusText = document.getElementById('status-text')!;
const connectBtn = document.getElementById('connect-btn')!;
const messagesDiv = document.getElementById('messages')!;

// Default to localhost, but configurable
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'ws://localhost:3000';

const client = new GameClient(SERVER_URL);

connectBtn.addEventListener('click', () => {
  if (client.isConnected()) {
    client.disconnect();
    connectBtn.textContent = 'Connect to Server';
    statusText.textContent = 'Disconnected';
  } else {
    client.connect();
    connectBtn.textContent = 'Disconnect';
    statusText.textContent = 'Connecting...';
  }
});

// Listen to client events
client.on('connected', () => {
  statusText.textContent = '✅ Connected to Akalynth';
  addMessage('Connected to server');
});

client.on('disconnected', () => {
  statusText.textContent = '❌ Disconnected';
  connectBtn.textContent = 'Connect to Server';
  addMessage('Disconnected from server');
});

client.on('message', (data: any) => {
  if (data.type === 'welcome') {
    addMessage(`🏰 ${data.message}`);
    addMessage(`Player ID: ${data.playerId}`);
  } else {
    addMessage(`Server: ${JSON.stringify(data)}`);
  }
});

client.on('error', (error: Error) => {
  addMessage(`❌ Error: ${error.message}`);
});

function addMessage(text: string): void {
  const messageEl = document.createElement('div');
  messageEl.className = 'message';
  messageEl.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  messagesDiv.appendChild(messageEl);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
