//! Chronicle append CLI
//!
//! Reads canonical JSON from stdin, appends to the chronicle log, outputs receipt as JSON.
//!
//! # Usage
//!
//! ```bash
//! echo '{"tick":1,"event_type":"spawn"}' | chronicle_append --log ./chronicle.log --key ./server.key
//! ```
//!
//! # Output
//!
//! Outputs a single JSON line with the receipt:
//! ```json
//! {"prev_hash":"genesis","event_hash":"blake3:...","signature":"...","root":"...","sequence":1}
//! ```

use std::fs;
use std::io::{self, Read};
use std::path::PathBuf;

use chronicle::Chronicle;
use ed25519_dalek::SigningKey;

const HELP: &str = r#"
chronicle_append - Append events to the Akalynth chronicle

USAGE:
    chronicle_append [OPTIONS]

OPTIONS:
    --log <PATH>     Path to chronicle log file (default: ./chronicle.log)
    --key <PATH>     Path to Ed25519 signing key file (generates if missing)
    --verify         Verify existing chronicle instead of appending
    --help           Show this help message

STDIN:
    When appending, reads JSON event data from stdin

OUTPUT:
    Outputs JSON receipt to stdout:
    {"prev_hash":"...","event_hash":"...","signature":"...","root":"...","sequence":N}

EXAMPLES:
    # Append a spawn event
    echo '{"tick":1,"event_type":"spawn","actor":"player:abc"}' | chronicle_append

    # Verify chronicle integrity
    chronicle_append --verify --log ./chronicle.log
"#;

fn main() {
    if let Err(e) = run() {
        eprintln!("error: {}", e);
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();

    // Parse arguments
    let mut log_path = PathBuf::from("./chronicle.log");
    let mut key_path = PathBuf::from("./chronicle.key");
    let mut verify_mode = false;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--help" | "-h" => {
                print!("{}", HELP);
                return Ok(());
            }
            "--log" => {
                i += 1;
                log_path = PathBuf::from(&args[i]);
            }
            "--key" => {
                i += 1;
                key_path = PathBuf::from(&args[i]);
            }
            "--verify" => {
                verify_mode = true;
            }
            _ => {
                return Err(format!("unknown argument: {}", args[i]).into());
            }
        }
        i += 1;
    }

    // Load or generate signing key
    let signing_key = load_or_generate_key(&key_path)?;

    if verify_mode {
        // Verify mode
        let chronicle = Chronicle::new(&log_path, signing_key)?;
        let result = chronicle.verify()?;

        let output = serde_json::json!({
            "valid": result.valid,
            "entries": result.entries,
            "root": result.root,
            "pubkey": chronicle.verifying_key_hex()
        });

        println!("{}", serde_json::to_string(&output)?);
    } else {
        // Append mode - read JSON from stdin
        let mut input = String::new();
        io::stdin().read_to_string(&mut input)?;

        let input = input.trim();
        if input.is_empty() {
            return Err("no input provided on stdin".into());
        }

        // Parse as generic JSON value (we don't need to know the schema)
        let event: serde_json::Value = serde_json::from_str(input)?;

        // Append to chronicle
        let mut chronicle = Chronicle::new(&log_path, signing_key)?;
        let receipt = chronicle.append(&event)?;

        // Output receipt
        let output = serde_json::json!({
            "prev_hash": receipt.prev_hash,
            "event_hash": receipt.event_hash,
            "signature": receipt.signature,
            "root": receipt.root,
            "sequence": receipt.sequence
        });

        println!("{}", serde_json::to_string(&output)?);
    }

    Ok(())
}

/// Load signing key from file, or generate and save a new one
fn load_or_generate_key(path: &PathBuf) -> Result<SigningKey, Box<dyn std::error::Error>> {
    if path.exists() {
        // Load existing key
        let bytes = fs::read(path)?;
        if bytes.len() != 32 {
            return Err(format!("invalid key file: expected 32 bytes, got {}", bytes.len()).into());
        }
        let mut key_bytes = [0u8; 32];
        key_bytes.copy_from_slice(&bytes);
        Ok(SigningKey::from_bytes(&key_bytes))
    } else {
        // Generate new key
        let mut rng = rand::thread_rng();
        let key = SigningKey::generate(&mut rng);

        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        // Save key
        fs::write(path, key.to_bytes())?;

        eprintln!("Generated new signing key: {}", path.display());
        Ok(key)
    }
}
