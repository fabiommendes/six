//! The fixed benchmark of `seks_bots::bench`, as a program of its own so it
//! also builds for `wasm32-wasip1` (the command line does not: it uses
//! threads). `seks-bots bench` runs the same code natively.
//!
//!     cargo run --release --example bench [-- SPEC]
//!     cargo build --release --example bench --target wasm32-wasip1
//!     node wasm/bench.mjs

fn main() {
    let spec = std::env::args().nth(1).unwrap_or_else(|| "ab".into());
    match seks_bots::bench::run(&spec) {
        Ok(report) => println!("{report}"),
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    }
}
