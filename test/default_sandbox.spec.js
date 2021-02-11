import { parser_factory } from "../build/library/parsers/parser.js";


const
    parser = parser_factory.parser,
    data = `abb`,
    data2 = "aaaaaabbbbbbbbbbbbbbbb";

assert_group(1200, sequence, () => {
    assert("test", inspect, parser(data2) == false);
});