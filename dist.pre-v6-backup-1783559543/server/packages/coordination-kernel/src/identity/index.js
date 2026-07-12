// Identity Module Exports
// Authentication key derivation and token signing
export { deriveAuthSeed, deriveAuthKeyPair, loadAuthKeyPair, getAuthKeyDomain, } from './key.js';
export { signToken, verifyToken, computeTokenId, generateNonce, DEFAULT_TOKEN_TTL_MS, MAX_TOKEN_TTL_MS, } from './token.js';
