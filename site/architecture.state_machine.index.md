# [Architecture](./architecture.index.md)::State Machine

A parser generated by Hydrocarbon is compiled to [bytecode](./architecture.bytecode.index.md) designed to run on a virtual state machine. This state machine is implemented as efficeiently as possible as modules available in each target language. 

The state machine can be thought of as a grammar recognizer that emits [regonizer parse actions](./architecture.recognizer_parse_actions.index.md) that defines how an input should be tokenized and then how those tokens should be composed into ASTs. Additional internal parse actions are emitted for cases where the recognizer needs to fork to handle the parse of ambiguous productions, for when the recognizer can skip of a set of characters which can then be evaluated later (lazy parsing), and when an unreconciled error forces the recognizer to stop evaluating an input.

The basic flow of a parse state is as follows: The first instruction is decoded and the appropriate handler is called. If it is a branch action,
as is the case with the `TABLE_BR` and `HASH_BR` instructions, then a scanner pass may be initiated. The scanner states use the same architecture as 
normal parse states save for a few notable differences: 
- Scanner states do not generate parse actions for the completer
- Scanner state branches do not utilize the `token` lexer mode. They instead have access to `byte`, `codepoint` and `class` lexer modes.
- The completion of a scanner parser yields `token_type` and `token_length` values which can then be used by parse states to branch to 
appropriate states that ultimately consume the token span.

- `FAIL` flag
- State Decoder
- Instruction Dispatch
    
    see [bytecode]("./architecture.bytecode.index.md)

Byte code buffer:

Every bytecode buffer contains the following values in word positions
`0x0`-`0x5`. This means that first state of a compiled grammar is found at 
`0x6` 

[source file](../source/typescript/build/bytecode.ts)

- `0x0` Default Fail Instruction
- `0x1` Default Pass Instruction
- `0x2` Default Fall Through Instruction
- `0x3` NOOP
- `0x4` Default Pass State Pointer
- `0x5` NOOP


```rust
use candlelib_hydrocarbon::completer::complete;
use candlelib_hydrocarbon::recognizer::recognize;

let (mut valid, mut invalid) = run(
        instructions.as_ptr(),
        instructions.len(),
        input.as_ptr(),
        input.len(),
        67109064,
    );

complete(input.as_ptr(), input.len(), &mut valid);

```
