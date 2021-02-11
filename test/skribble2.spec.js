import { parser, sk } from "../build/library/utilities/skribble/skribble_2.js";

assert_group(sequence, () => {


    assert(parser("[mut] t:u32 = 0xFFF") == "");
    const a = sk`[mut] fn a:u32(a:u32) {2 + a}`;
    const d = sk`
    [mut] t:u32 = ${a} 
    [mut] t:u32 = ${{ nroca: 2 }}`;

    assert(d == "");
});