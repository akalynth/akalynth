#!/usr/bin/env node
/**
 * Generate combat test data for E3/E4 verification.
 * Creates two players, gives them items, moves to Azura, and has one kill the other.
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3000';

function createClient(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const client = {
      ws,
      name,
      playerId: null,
      guestToken: null,
      messages: [],
      send(msg) {
        console.log(`[${name}] SEND:`, msg.type);
        ws.send(JSON.stringify(msg));
      },
      waitFor(type, timeout = 5000) {
        return new Promise((res, rej) => {
          const start = Date.now();
          const check = () => {
            const idx = this.messages.findIndex(m => m.type === type);
            if (idx >= 0) {
              const msg = this.messages[idx];
              this.messages.splice(idx, 1);
              res(msg);
            } else if (Date.now() - start > timeout) {
              console.log(`[${name}] Pending messages:`, this.messages.map(m => m.type));
              rej(new Error(`Timeout waiting for ${type}`));
            } else {
              setTimeout(check, 50);
            }
          };
          check();
        });
      }
    };

    ws.on('open', () => resolve(client));
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log(`[${name}] RECV:`, msg.type);
      client.messages.push(msg);
    });
    ws.on('error', reject);
  });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('Creating two clients...');

  const attacker = await createClient('attacker');
  const victim = await createClient('victim');

  // Wait for welcome
  await attacker.waitFor('welcome');
  await victim.waitFor('welcome');
  console.log('Both clients connected');

  // Login both
  attacker.send({ type: 'login', guest_token: null });
  victim.send({ type: 'login', guest_token: null });

  const attackerAck = await attacker.waitFor('login_ack');
  const victimAck = await victim.waitFor('login_ack');

  attacker.playerId = attackerAck.player_id;
  victim.playerId = victimAck.player_id;

  console.log(`Attacker: ${attacker.playerId}`);
  console.log(`Victim: ${victim.playerId}`);

  // Enter world (spawns in Rookguard)
  attacker.send({ type: 'enter_world' });
  victim.send({ type: 'enter_world' });

  // Wait a bit for world state
  await sleep(1000);

  // Check what messages we got
  console.log('Attacker messages after enter_world:', attacker.messages.map(m => m.type));
  console.log('Victim messages after enter_world:', victim.messages.map(m => m.type));

  // Clear old messages
  attacker.messages = [];
  victim.messages = [];

  // Give attacker a legendary item (so drops are interesting)
  attacker.send({ type: 'mint_legendary', tier: 2 });
  await sleep(500);

  // Give victim some items
  victim.send({ type: 'mint_legendary', tier: 1 });
  await sleep(500);

  console.log('Items minted. Now moving to Azura...');

  // Move both through the Rookguard->Azura portal
  // Portal is typically at bottom-right corner of Rookguard
  // Spawn is at (15, 3), portal should be around (30, 30) area

  // Move south then east
  for (let i = 0; i < 25; i++) {
    attacker.send({ type: 'move_intent', direction: 'south' });
    victim.send({ type: 'move_intent', direction: 'south' });
    await sleep(110);
  }

  for (let i = 0; i < 15; i++) {
    attacker.send({ type: 'move_intent', direction: 'east' });
    victim.send({ type: 'move_intent', direction: 'east' });
    await sleep(110);
  }

  await sleep(500);
  console.log('Movement complete. Checking messages...');
  console.log('Attacker recent:', attacker.messages.slice(-5).map(m => m.type));

  // Now they should be in Azura (or close to it)
  // Try kill_self on victim to generate death data with drops
  console.log('Using kill_self to generate death with drops...');
  victim.send({ type: 'kill_self' });

  await sleep(1000);

  // Check for death notice
  const deathMsgs = victim.messages.filter(m => m.type === 'death_notice');
  console.log('Death notices:', deathMsgs.length);

  // Also try combat if they're adjacent
  console.log('Attempting combat attack...');
  attacker.send({ type: 'attack_intent', target_player_id: victim.playerId });
  await sleep(500);

  const combatMsgs = attacker.messages.filter(m => m.type === 'combat_resolved' || m.type === 'combat_rejected');
  console.log('Combat messages:', combatMsgs.map(m => ({ type: m.type, reason: m.reason })));

  // Give server time to flush receipts
  await sleep(1000);

  console.log('Test scenario complete. Closing connections...');
  attacker.ws.close();
  victim.ws.close();

  await sleep(500);
  console.log('Done.');
  process.exit(0);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
