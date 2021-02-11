## A Hydrocarbon Parser

Character sequences are stored in a lookup table for fast comparisons to the input

```TypeScript
const lookup: Unit8Array = "abcandyjdefghijklmnopfgdfgdfffffffffffffffffffffffffffffffffffffffffffffffffffffff"

/**
 * Input should always be padded with as many null characters as the longest character
 * sequence in the lookup
 */

/**
 * Returns largest number of matched characters
 */
function bytecmp(
    lookup:  Uint8Array, 
    input :  Uint8Array, 
    lookup_offset : number, 
    input_offset : number, 
    sequence_length : number,
): number{
    let j = lookup_offset;
    let i = input_offset;

    for(let i =0; i < sequence_length; i++, j++)
        if(input[j] != lookup[i]) return i;

    return sequence_length;
}
```

```rust

#[wasm_bindgen]
struct parser_buffers{
    error: Vec<uint8>;
    debug:
    rules:
}
?

```


Setup Rust Install 

Default Stack Size is 1MB
```
-C link-arg=-zstack-size=16
```

```bash
#Rust Stuf
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
rustup update

#Wasm stuff
cargo install-update -a

curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

cargo install cargo-generate

wasm-pack build

# Optimize for size.
wasm-opt -Os -o output.wasm input.wasm

# Optimize aggressively for size.
wasm-opt -Oz -o output.wasm input.wasm

# Optimize for speed.
wasm-opt -O -o output.wasm input.wasm

# Optimize aggressively for speed.
wasm-opt -O3 -o output.wasm input.wasm
```
cargo.toml File 
```
[package]
name = "temp"
version = "0.1.0"
authors = *
edition = "2018"

[lib]
crate-type = ["cdylib", "rlib"]

[features]
default = ["console_error_panic_hook"]

[dependencies]
wasm-bindgen = "0.2.70"

# The `console_error_panic_hook` crate provides better debugging of panics by
# logging them with `console.error`. This is great for development, but requires
# all the `std::fmt` and `std::panicking` infrastructure, so isn't great for
# code size when deploying.
console_error_panic_hook = { version = "0.1.6", optional = true }

# `wee_alloc` is a tiny allocator for wasm that is only ~1K in code size
# compared to the default allocator's ~10K. It is slower than the default
# allocator, however.
#
# Unfortunately, `wee_alloc` requires nightly Rust when targeting wasm for now.
wee_alloc = { version = "0.4.5", optional = true }

[dev-dependencies]
wasm-bindgen-test = "0.3.13"

[profile.release]
# Tell `rustc` to optimize for small code size.
opt-level = "s"

```
