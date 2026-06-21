// WebCrypto-backed Adventurer Seal service for the web debug client.
// Mirrors AdventurerSealKeyStore (Android Keystore) and IdentityApi (Android HTTP).
// Private key is stored in IndexedDB as a non-extractable CryptoKey.

const DB_NAME = 'akalynth-seal';
const DB_VERSION = 1;
const STORE_NAME = 'keys';
const KEY_ID = 'principal_key';
const PRINCIPAL_STORE = 'principal';

// --------------------------------------------------------------------------
// IndexedDB helpers
// --------------------------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
      req.result.createObjectStore(PRINCIPAL_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(store: string, key: IDBValidKey, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(store: string, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// --------------------------------------------------------------------------
// Encoding helpers
// --------------------------------------------------------------------------

function arrayBufferToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function spkiToPublicKeyPem(spki: ArrayBuffer): string {
  const b64 = arrayBufferToBase64(spki);
  const lines = b64.match(/.{1,64}/g)?.join('\n') ?? b64;
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
}

// --------------------------------------------------------------------------
// Key management
// --------------------------------------------------------------------------

const ECDSA_PARAMS: EcKeyGenParams = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN_PARAMS: EcdsaParams = { name: 'ECDSA', hash: { name: 'SHA-256' } };

export async function generateKeyPair(): Promise<string> {
  const keyPair = await crypto.subtle.generateKey(ECDSA_PARAMS, true, ['sign', 'verify']);

  // Store public key as SPKI, private key as JWK (extractable during storage only).
  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  await dbPut(STORE_NAME, KEY_ID + ':spki', spki);
  await dbPut(STORE_NAME, KEY_ID + ':jwk', privateJwk);

  return spkiToPublicKeyPem(spki);
}

export async function getPublicKeyPem(): Promise<string | null> {
  const spki = await dbGet<ArrayBuffer>(STORE_NAME, KEY_ID + ':spki');
  if (!spki) return null;
  return spkiToPublicKeyPem(spki);
}

export async function hasKey(): Promise<boolean> {
  const spki = await dbGet<ArrayBuffer>(STORE_NAME, KEY_ID + ':spki');
  return !!spki;
}

export async function signCanonicalPayload(canonicalPayload: string): Promise<string> {
  const jwk = await dbGet<JsonWebKey>(STORE_NAME, KEY_ID + ':jwk');
  if (!jwk) throw new Error('No Seal key found. Claim a Seal first.');

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    ECDSA_PARAMS,
    false,
    ['sign']
  );

  const encoded = new TextEncoder().encode(canonicalPayload);
  const signature = await crypto.subtle.sign(SIGN_PARAMS, privateKey, encoded);

  return base64ToBase64Url(arrayBufferToBase64(signature));
}

export async function clearKeys(): Promise<void> {
  await dbDelete(STORE_NAME, KEY_ID + ':spki');
  await dbDelete(STORE_NAME, KEY_ID + ':jwk');
}

// --------------------------------------------------------------------------
// Principal session storage (principal_id, handle, session_token)
// --------------------------------------------------------------------------

export interface SavedPrincipal {
  principal_id: string;
  handle: string;
  session_token: string;
  expires_at: string;
}

export async function savePrincipal(p: SavedPrincipal): Promise<void> {
  await dbPut(PRINCIPAL_STORE, 'current', p);
}

export async function getSavedPrincipal(): Promise<SavedPrincipal | null> {
  return (await dbGet<SavedPrincipal>(PRINCIPAL_STORE, 'current')) ?? null;
}

export async function clearPrincipal(): Promise<void> {
  await dbDelete(PRINCIPAL_STORE, 'current');
}

// --------------------------------------------------------------------------
// HTTP API wrappers — mirrors IdentityApi.kt
// --------------------------------------------------------------------------

async function post<T>(httpBase: string, path: string, body: unknown, sessionToken?: string): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (sessionToken) headers['authorization'] = `Bearer ${sessionToken}`;
  const resp = await fetch(`${httpBase.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok || data?.ok === false) {
    const code = data?.error ?? data?.code ?? resp.status.toString();
    throw new Error(code);
  }
  return data as T;
}

export async function registerPrincipal(httpBase: string, handle: string, publicKeySpkiPem: string): Promise<{ principal_id: string; loss_warning: string }> {
  const data = await post<{ principal: { principal_id: string }; loss_warning: string }>(
    httpBase,
    '/v1/principals/register',
    { handle, public_key_spki_pem: publicKeySpkiPem, accepted_terms: true, client: 'web' }
  );
  return { principal_id: data.principal.principal_id, loss_warning: data.loss_warning };
}

export async function requestChallenge(httpBase: string, principalId: string, purpose: string): Promise<{ challenge_id: string; canonical_payload: string }> {
  const data = await post<{ challenge_id: string; canonical_payload: string }>(
    httpBase,
    '/v1/principals/challenge',
    { principal_id: principalId, purpose, domain: 'akalynth.com', client: 'web' }
  );
  return { challenge_id: data.challenge_id, canonical_payload: data.canonical_payload };
}

export async function verifyChallenge(httpBase: string, principalId: string, challengeId: string, signatureBase64url: string): Promise<{ session_token: string; expires_at: string; handle: string }> {
  const data = await post<{ session_token: string; expires_at: string; principal: { handle: string } }>(
    httpBase,
    '/v1/principals/verify',
    { principal_id: principalId, challenge_id: challengeId, signature_base64url: signatureBase64url }
  );
  return { session_token: data.session_token, expires_at: data.expires_at, handle: data.principal.handle };
}

export async function reportPrincipal(httpBase: string, sessionToken: string, targetPrincipalId: string, reason: string): Promise<void> {
  await post(httpBase, '/v1/principals/report', { target_principal_id: targetPrincipalId, reason, detail: reason }, sessionToken);
}

export async function blockPrincipal(httpBase: string, sessionToken: string, targetPrincipalId: string, reason: string): Promise<void> {
  await post(httpBase, '/v1/principals/block', { target_principal_id: targetPrincipalId, reason }, sessionToken);
}

export async function signedSelfAction(httpBase: string, principalId: string, sessionToken: string, purpose: 'principal_retire' | 'principal_delete'): Promise<void> {
  const { challenge_id, canonical_payload } = await requestChallenge(httpBase, principalId, purpose);
  const sig = await signCanonicalPayload(canonical_payload);
  if (purpose === 'principal_retire') {
    await post(httpBase, '/v1/principals/retire', { principal_id: principalId, challenge_id, signature_base64url: sig }, sessionToken);
  } else {
    await post(httpBase, '/v1/principals/delete', { principal_id: principalId, challenge_id, signature_base64url: sig }, sessionToken);
  }
}
