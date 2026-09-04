fn main() {
    // Explicitly watch Native IPC / ACL inputs so patch overlays cannot leave a stale Rust runtime.
    println!("cargo:rerun-if-changed=src/lib.rs");
    println!("cargo:rerun-if-changed=permissions");
    println!("cargo:rerun-if-changed=capabilities");
    println!("cargo:rerun-if-changed=tauri.conf.json");
    tauri_build::build()
}
