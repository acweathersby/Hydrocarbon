import { parser_factory } from "../../parsers/parser.js";

const { parser: skribble_parser } = parser_factory;
export function parser(string) {

    const { result, FAILED, error_message } = skribble_parser(string);

    if (FAILED) {
        throw new SyntaxError(error_message);
    }

    return result[0];
}

export function sk(templates: TemplateStringsArray, ...node_stack) {

    const nodes = node_stack;//.reverse();

    const env = { node_stack: node_stack.reverse(), grabTemplateNode: () => nodes.pop() };

    const str = templates.join("<<-- -->>");

    const { result, FAILED, error_message } = skribble_parser(str, env);

    if (FAILED) {
        throw new SyntaxError(error_message);
    }

    return result[0][0];

}