//! Step 1 determinism parity gate for witness-kernel-rust.
//!
//! Asserts the Rust witness primitives produce byte-for-byte identical canonical JSON and
//! BLAKE3 hashes to the TS oracle (parity/gen-golden.mjs) for every vector in parity/vectors.json.
//! If this diverges, the witness chain would fork across languages — that is exactly what this
//! gate exists to prevent before any napi-rs rewrite lands.
//!
//! Regenerate the golden after editing vectors:  node crates/chronicle/parity/gen-golden.mjs
//! Run this gate:                                 cd crates/chronicle && cargo test --test parity

use chronicle::{blake3_hex, canonical_json};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;

fn parity_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("parity").join(name)
}

fn load(name: &str) -> Value {
    let p = parity_path(name);
    let raw = fs::read_to_string(&p).unwrap_or_else(|e| {
        panic!(
            "could not read {}: {e}\n  If golden.json is missing, generate it first:\n  node crates/chronicle/parity/gen-golden.mjs",
            p.display()
        )
    });
    serde_json::from_str(&raw).unwrap_or_else(|e| panic!("invalid JSON in {}: {e}", p.display()))
}

#[test]
fn rust_matches_ts_golden() {
    let vectors = load("vectors.json");
    let golden = load("golden.json");

    let list = vectors["vectors"].as_array().expect("vectors.json: .vectors must be an array");
    assert!(!list.is_empty(), "vectors.json has no vectors");

    let mut checked = 0usize;
    for v in list {
        let name = v["name"].as_str().expect("vector missing string .name");
        let input = &v["input"];

        let want = &golden[name];
        assert!(
            !want.is_null(),
            "golden.json has no entry for vector '{name}' — regenerate: node crates/chronicle/parity/gen-golden.mjs"
        );

        // Rust side of the determinism core.
        let rust_canonical = canonical_json(input).expect("canonical_json failed");
        let rust_hash = blake3_hex(&rust_canonical);

        let want_canonical = want["canonical_json"].as_str().expect("golden missing canonical_json");
        let want_hash = want["blake3_hex"].as_str().expect("golden missing blake3_hex");

        assert_eq!(
            rust_canonical, want_canonical,
            "\nCANONICAL JSON DIVERGENCE for vector '{name}':\n  rust: {rust_canonical}\n  ts:   {want_canonical}\n  ({})",
            v["note"].as_str().unwrap_or("")
        );
        assert_eq!(
            rust_hash, want_hash,
            "\nBLAKE3 DIVERGENCE for vector '{name}':\n  rust: {rust_hash}\n  ts:   {want_hash}",
        );
        checked += 1;
    }

    assert_eq!(
        checked,
        golden.as_object().map(|m| m.len()).unwrap_or(0),
        "vector/golden count mismatch — golden.json is stale; regenerate it"
    );
}
