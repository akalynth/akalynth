// Build script for the chronicle crate.
//
// Does nothing on the default build path (Step 0 bench, Step 1 parity, the `chronicle_append` bin):
// the `napi_build::setup()` call is compiled in ONLY when `--features napi` is set, and the
// `napi-build` dependency is itself optional and pulled in only by that feature. So a plain
// `cargo build` / `cargo test` runs an empty `main()` from the crate directory.
fn main() {
    #[cfg(feature = "napi")]
    napi_build::setup();
}
