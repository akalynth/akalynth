//! napi-rs in-process binding surface for the chronicle witness kernel (migration Step 2).
//!
//! Compiled ONLY under `--features napi` (see Cargo.toml). The default `cargo build`/`cargo test`
//! path — used by the Step 0 benchmark and the Step 1 parity gate — never compiles this module, so
//! the rlib + `chronicle_append` bin are unaffected.
//!
//! This replaces the spawn-per-event bridge: open ONE long-lived handle at server boot, then call
//! `append` per event. The handle keeps `last_hash`+`sequence` in memory (the `Chronicle` struct
//! already does), so each append is O(1) amortized instead of the subprocess model's per-event
//! process spawn + full-log `read_tail` rescan. See references/OPTIMIZATION_PROPOSAL.md.
//!
//! STATUS: compiled and smoke-tested locally through the gated `napi/run-step2.sh` runner after
//! Step 0 benchmark evidence and Step 1 TS/Rust parity passed.

use ed25519_dalek::SigningKey;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::path::Path;

use crate::{Chronicle, ChronicleError};

fn to_napi_err<E: std::fmt::Display>(e: E) -> Error {
    Error::from_reason(e.to_string())
}

fn chronicle_err(e: ChronicleError) -> Error {
    Error::from_reason(e.to_string())
}

/// Canonicalize a JSON string using the Rust witness kernel primitive.
#[napi]
pub fn canonical_json_string(value_json: String) -> Result<String> {
    let value: serde_json::Value = serde_json::from_str(&value_json).map_err(to_napi_err)?;
    crate::canonical_json(&value).map_err(chronicle_err)
}

/// Raw BLAKE3 hex of a UTF-8 string using the Rust witness kernel primitive.
#[napi]
pub fn blake3_hex_utf8(value: String) -> String {
    crate::blake3_hex(&value)
}

/// Raw BLAKE3 hex of bytes using the Rust witness kernel primitive.
#[napi]
pub fn blake3_hex_bytes(value: Buffer) -> String {
    crate::blake3_hex_bytes(value.as_ref())
}

/// Load an Ed25519 signing key from `path`, generating + persisting one if absent.
/// Mirrors `load_or_generate_key` in src/bin/chronicle_append.rs so the binding and CLI agree.
fn load_or_generate_key(path: &Path) -> std::result::Result<SigningKey, String> {
    if path.exists() {
        let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
        if bytes.len() != 32 {
            return Err(format!("invalid key file: expected 32 bytes, got {}", bytes.len()));
        }
        let mut key_bytes = [0u8; 32];
        key_bytes.copy_from_slice(&bytes);
        Ok(SigningKey::from_bytes(&key_bytes))
    } else {
        let mut rng = rand::thread_rng();
        let key = SigningKey::generate(&mut rng);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::write(path, key.to_bytes()).map_err(|e| e.to_string())?;
        Ok(key)
    }
}

/// Receipt returned to JS after an append. Mirrors `chronicle::Receipt`.
/// `sequence` is exposed as i64 (napi has no native u64); the chain is far within i64 range.
#[napi(object)]
pub struct JsReceipt {
    pub prev_hash: String,
    pub event_hash: String,
    pub signature: String,
    pub root: String,
    pub sequence: i64,
}

/// Verification result returned to JS. Mirrors `chronicle::VerifyResult` plus the public key.
#[napi(object)]
pub struct JsVerify {
    pub valid: bool,
    pub entries: i64,
    pub root: Option<String>,
    pub pubkey: String,
}

/// Long-lived in-process chronicle handle. Open once at boot; reuse for every append.
#[napi]
pub struct ChronicleHandle {
    inner: Chronicle,
}

#[napi]
impl ChronicleHandle {
    /// Open (or resume) a chronicle log, loading/generating the signing key at `key_path`.
    /// Honors the same paths as the CLI (`CHRONICLE_LOG_PATH` / `CHRONICLE_KEY_PATH` are resolved
    /// by the JS caller and passed in here).
    #[napi(factory)]
    pub fn open(log_path: String, key_path: String) -> Result<Self> {
        let key = load_or_generate_key(Path::new(&key_path)).map_err(to_napi_err)?;
        let inner = Chronicle::new(&log_path, key).map_err(chronicle_err)?;
        Ok(Self { inner })
    }

    /// Append one event (canonical or arbitrary JSON string) and return its receipt.
    /// The kernel canonicalizes deterministically; do not pre-canonicalize differently on the JS side.
    #[napi]
    pub fn append(&mut self, event_json: String) -> Result<JsReceipt> {
        let value: serde_json::Value = serde_json::from_str(&event_json).map_err(to_napi_err)?;
        let r = self.inner.append(&value).map_err(chronicle_err)?;
        Ok(JsReceipt {
            prev_hash: r.prev_hash,
            event_hash: r.event_hash,
            signature: r.signature,
            root: r.root,
            sequence: r.sequence as i64,
        })
    }

    /// Verify the full chain integrity of the log.
    #[napi]
    pub fn verify(&self) -> Result<JsVerify> {
        let v = self.inner.verify().map_err(chronicle_err)?;
        Ok(JsVerify {
            valid: v.valid,
            entries: v.entries as i64,
            root: v.root,
            pubkey: self.inner.verifying_key_hex(),
        })
    }

    /// Current sequence number (number of appended entries).
    #[napi(getter)]
    pub fn sequence(&self) -> i64 {
        self.inner.sequence() as i64
    }

    /// Hex-encoded Ed25519 public (verifying) key — for `/v1/transparency` parity.
    #[napi(getter)]
    pub fn public_key_hex(&self) -> String {
        self.inner.verifying_key_hex()
    }
}
