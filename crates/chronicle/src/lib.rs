//! Chronicle: Append-only witness kernel for Akalynth
//!
//! This crate provides cryptographic witnessing of game events with the following guarantees:
//!
//! 1. **Append-only**: Events can only be added, never modified or removed
//! 2. **Hash-chained**: Each event includes the hash of the previous event
//! 3. **Signed**: Each event is signed by the server's Ed25519 key
//! 4. **Deterministic**: Same input always produces same canonical JSON
//!
//! # Log Format
//!
//! Each line in the chronicle log follows this format:
//! ```text
//! <prev_hash>|<event_hash>|<signature>|<canonical_json>
//! ```
//!
//! Where:
//! - `prev_hash`: BLAKE3 hash of the previous line (or "genesis" for first entry)
//! - `event_hash`: BLAKE3 hash of the canonical JSON
//! - `signature`: Ed25519 signature of `prev_hash|event_hash` (hex-encoded)
//! - `canonical_json`: Sorted keys, no whitespace, UTF-8

use std::fs::{File, OpenOptions};
use std::io::{self, BufRead, BufReader, Write};
use std::path::{Path, PathBuf};

use blake3::Hasher;
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Genesis marker for the first entry in a chronicle
pub const GENESIS_MARKER: &str = "genesis";

/// Chronicle error types
#[derive(Error, Debug)]
pub enum ChronicleError {
    #[error("IO error: {0}")]
    Io(#[from] io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Signature error: {0}")]
    Signature(#[from] ed25519_dalek::SignatureError),

    #[error("Invalid log format at line {line}: {reason}")]
    InvalidFormat { line: usize, reason: String },

    #[error("Chain broken at line {line}: expected prev_hash {expected}, got {actual}")]
    ChainBroken {
        line: usize,
        expected: String,
        actual: String,
    },

    #[error("Invalid signature at line {line}")]
    InvalidSignature { line: usize },

    #[error("Event hash mismatch at line {line}: expected {expected}, got {actual}")]
    HashMismatch {
        line: usize,
        expected: String,
        actual: String,
    },
}

/// Result type for chronicle operations
pub type Result<T> = std::result::Result<T, ChronicleError>;

/// Receipt returned after successfully appending an event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Receipt {
    /// Hash of the previous entry (or "genesis")
    pub prev_hash: String,
    /// BLAKE3 hash of the canonical JSON
    pub event_hash: String,
    /// Ed25519 signature of `prev_hash|event_hash`
    pub signature: String,
    /// Current Merkle root (for now, just the latest event_hash)
    pub root: String,
    /// Line number in the log (1-indexed)
    pub sequence: u64,
}

/// Chronicle witness kernel
pub struct Chronicle {
    /// Path to the log file
    log_path: PathBuf,
    /// Ed25519 signing key
    signing_key: SigningKey,
    /// Hash of the last entry (or None if empty)
    last_hash: Option<String>,
    /// Current sequence number
    sequence: u64,
}

impl Chronicle {
    /// Create a new chronicle with an existing signing key
    pub fn new(log_path: impl AsRef<Path>, signing_key: SigningKey) -> Result<Self> {
        let log_path = log_path.as_ref().to_path_buf();

        // Ensure parent directory exists
        if let Some(parent) = log_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        // Read existing log to find last hash and sequence
        let (last_hash, sequence) = if log_path.exists() {
            Self::read_tail(&log_path)?
        } else {
            (None, 0)
        };

        Ok(Self {
            log_path,
            signing_key,
            last_hash,
            sequence,
        })
    }

    /// Create a new chronicle with a freshly generated key
    pub fn new_with_generated_key(log_path: impl AsRef<Path>) -> Result<Self> {
        let mut rng = rand::thread_rng();
        let signing_key = SigningKey::generate(&mut rng);
        Self::new(log_path, signing_key)
    }

    /// Get the verifying (public) key
    pub fn verifying_key(&self) -> VerifyingKey {
        self.signing_key.verifying_key()
    }

    /// Get the verifying key as hex string
    pub fn verifying_key_hex(&self) -> String {
        hex::encode(self.verifying_key().as_bytes())
    }

    /// Append an event to the chronicle
    ///
    /// The event is serialized to canonical JSON (sorted keys, no whitespace),
    /// hash-chained to the previous entry, and signed.
    pub fn append<T: Serialize>(&mut self, event: &T) -> Result<Receipt> {
        // Serialize to canonical JSON
        let canonical_json = canonical_json(event)?;

        // Compute event hash
        let event_hash = blake3_hex(&canonical_json);

        // Get previous hash
        let prev_hash = self.last_hash.clone().unwrap_or_else(|| GENESIS_MARKER.to_string());

        // Sign prev_hash|event_hash
        let message = format!("{}|{}", prev_hash, event_hash);
        let signature = self.signing_key.sign(message.as_bytes());
        let signature_hex = hex::encode(&signature.to_bytes());

        // Format log line
        let log_line = format!("{}|{}|{}|{}\n", prev_hash, event_hash, signature_hex, canonical_json);

        // Append to file
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.log_path)?;
        file.write_all(log_line.as_bytes())?;
        file.sync_all()?;

        // Update state
        self.sequence += 1;
        self.last_hash = Some(event_hash.clone());

        Ok(Receipt {
            prev_hash,
            event_hash: event_hash.clone(),
            signature: signature_hex,
            root: event_hash, // Simple root for now
            sequence: self.sequence,
        })
    }

    /// Verify the integrity of the entire chronicle
    pub fn verify(&self) -> Result<VerifyResult> {
        Self::verify_file(&self.log_path, &self.verifying_key())
    }

    /// Verify a chronicle file with a given public key
    pub fn verify_file(log_path: &Path, verifying_key: &VerifyingKey) -> Result<VerifyResult> {
        if !log_path.exists() {
            return Ok(VerifyResult {
                valid: true,
                entries: 0,
                root: None,
            });
        }

        let file = File::open(log_path)?;
        let reader = BufReader::new(file);

        let mut prev_hash: Option<String> = None;
        let mut line_num = 0u64;
        let mut last_event_hash: Option<String> = None;

        for line_result in reader.lines() {
            line_num += 1;
            let line = line_result?;

            if line.trim().is_empty() {
                continue;
            }

            let parts: Vec<&str> = line.splitn(4, '|').collect();
            if parts.len() != 4 {
                return Err(ChronicleError::InvalidFormat {
                    line: line_num as usize,
                    reason: format!("expected 4 pipe-separated fields, got {}", parts.len()),
                });
            }

            let (claimed_prev, claimed_event_hash, sig_hex, json_data) =
                (parts[0], parts[1], parts[2], parts[3]);

            // Verify chain linkage
            let expected_prev = prev_hash.as_deref().unwrap_or(GENESIS_MARKER);
            if claimed_prev != expected_prev {
                return Err(ChronicleError::ChainBroken {
                    line: line_num as usize,
                    expected: expected_prev.to_string(),
                    actual: claimed_prev.to_string(),
                });
            }

            // Verify event hash
            let computed_hash = blake3_hex(json_data);
            if computed_hash != claimed_event_hash {
                return Err(ChronicleError::HashMismatch {
                    line: line_num as usize,
                    expected: claimed_event_hash.to_string(),
                    actual: computed_hash,
                });
            }

            // Verify signature
            let message = format!("{}|{}", claimed_prev, claimed_event_hash);
            let sig_bytes = hex::decode(sig_hex).map_err(|_| ChronicleError::InvalidFormat {
                line: line_num as usize,
                reason: "invalid hex in signature".to_string(),
            })?;
            let signature = Signature::from_slice(&sig_bytes)?;
            verifying_key
                .verify(message.as_bytes(), &signature)
                .map_err(|_| ChronicleError::InvalidSignature {
                    line: line_num as usize,
                })?;

            // Update for next iteration
            prev_hash = Some(claimed_event_hash.to_string());
            last_event_hash = Some(claimed_event_hash.to_string());
        }

        Ok(VerifyResult {
            valid: true,
            entries: line_num,
            root: last_event_hash,
        })
    }

    /// Read the last hash and sequence from an existing log
    fn read_tail(log_path: &Path) -> Result<(Option<String>, u64)> {
        let file = File::open(log_path)?;
        let reader = BufReader::new(file);

        let mut last_hash: Option<String> = None;
        let mut count = 0u64;

        for line_result in reader.lines() {
            let line = line_result?;
            if line.trim().is_empty() {
                continue;
            }

            let parts: Vec<&str> = line.splitn(4, '|').collect();
            if parts.len() >= 2 {
                last_hash = Some(parts[1].to_string());
                count += 1;
            }
        }

        Ok((last_hash, count))
    }

    /// Get current sequence number
    pub fn sequence(&self) -> u64 {
        self.sequence
    }

    /// Get the last event hash (or None if empty)
    pub fn last_hash(&self) -> Option<&str> {
        self.last_hash.as_deref()
    }
}

/// Result of chronicle verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyResult {
    pub valid: bool,
    pub entries: u64,
    pub root: Option<String>,
}

/// Compute BLAKE3 hash of data, returned as hex string
pub fn blake3_hex(data: &str) -> String {
    let mut hasher = Hasher::new();
    hasher.update(data.as_bytes());
    hasher.finalize().to_hex().to_string()
}

/// Serialize to canonical JSON (sorted keys, no whitespace)
pub fn canonical_json<T: Serialize>(value: &T) -> Result<String> {
    // serde_json with sorted keys
    let json_value = serde_json::to_value(value)?;
    let sorted = sort_json_value(&json_value);
    Ok(serde_json::to_string(&sorted)?)
}

/// Recursively sort JSON object keys
fn sort_json_value(value: &serde_json::Value) -> serde_json::Value {
    match value {
        serde_json::Value::Object(map) => {
            let mut sorted: serde_json::Map<String, serde_json::Value> = serde_json::Map::new();
            let mut keys: Vec<_> = map.keys().collect();
            keys.sort();
            for key in keys {
                sorted.insert(key.clone(), sort_json_value(&map[key]));
            }
            serde_json::Value::Object(sorted)
        }
        serde_json::Value::Array(arr) => {
            serde_json::Value::Array(arr.iter().map(sort_json_value).collect())
        }
        _ => value.clone(),
    }
}

/// Hex encoding/decoding module
mod hex {
    pub fn encode(bytes: &[u8]) -> String {
        bytes.iter().map(|b| format!("{:02x}", b)).collect()
    }

    pub fn decode(s: &str) -> std::result::Result<Vec<u8>, &'static str> {
        if s.len() % 2 != 0 {
            return Err("odd length hex string");
        }
        (0..s.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&s[i..i + 2], 16).map_err(|_| "invalid hex"))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[derive(Serialize)]
    struct TestEvent {
        tick: u64,
        event_type: &'static str,
        actor: &'static str,
    }

    #[test]
    fn test_append_and_verify() {
        let dir = tempdir().unwrap();
        let log_path = dir.path().join("test.log");

        let mut chronicle = Chronicle::new_with_generated_key(&log_path).unwrap();

        let event = TestEvent {
            tick: 1,
            event_type: "spawn",
            actor: "player:123",
        };

        let receipt = chronicle.append(&event).unwrap();
        assert_eq!(receipt.prev_hash, GENESIS_MARKER);
        assert_eq!(receipt.sequence, 1);

        let result = chronicle.verify().unwrap();
        assert!(result.valid);
        assert_eq!(result.entries, 1);
    }

    #[test]
    fn test_chain_integrity() {
        let dir = tempdir().unwrap();
        let log_path = dir.path().join("chain.log");

        let mut chronicle = Chronicle::new_with_generated_key(&log_path).unwrap();

        let r1 = chronicle
            .append(&TestEvent {
                tick: 1,
                event_type: "spawn",
                actor: "a",
            })
            .unwrap();

        let r2 = chronicle
            .append(&TestEvent {
                tick: 2,
                event_type: "move",
                actor: "a",
            })
            .unwrap();

        // Second event should chain from first
        assert_eq!(r2.prev_hash, r1.event_hash);

        let result = chronicle.verify().unwrap();
        assert!(result.valid);
        assert_eq!(result.entries, 2);
    }

    #[test]
    fn test_canonical_json_sorting() {
        #[derive(Serialize)]
        struct Unsorted {
            z: u32,
            a: u32,
            m: u32,
        }

        let json = canonical_json(&Unsorted { z: 3, a: 1, m: 2 }).unwrap();
        assert_eq!(json, r#"{"a":1,"m":2,"z":3}"#);
    }

    #[test]
    fn test_tamper_detection() {
        let dir = tempdir().unwrap();
        let log_path = dir.path().join("tamper.log");

        let mut chronicle = Chronicle::new_with_generated_key(&log_path).unwrap();
        let pubkey = chronicle.verifying_key();

        chronicle
            .append(&TestEvent {
                tick: 1,
                event_type: "spawn",
                actor: "a",
            })
            .unwrap();

        // Tamper with the file
        let content = std::fs::read_to_string(&log_path).unwrap();
        let tampered = content.replace("spawn", "HACKED");
        std::fs::write(&log_path, tampered).unwrap();

        // Verification should fail
        let result = Chronicle::verify_file(&log_path, &pubkey);
        assert!(result.is_err());
    }
}
