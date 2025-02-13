import URL from "@candlelib/uri";
import fs from "fs";
import { buildRecognizer } from "../build/library/build/build.js";
import { ParserFactoryNext } from "../build/library/entry/hydrocarbon.js";
import { compileGrammarFromString, compileGrammarFromURI } from "../build/library/grammar/compile.js";
import { generateJSParser } from "../build/library/render/render.js";
import { initializeUTFLookupTableNewPlus } from "../build/library/runtime/parser_memory_new.js";
const fsp = fs.promises;

/**
 * Compile a parser from a file path or an input string
 */
export async function compileJSParserFromGrammar(string_or_url, DEBUG = false, recognizer_type = "js") {

    const compiled_grammar = await compileGrammar(string_or_url);

    const { recognizer_functions, meta } = await buildRecognizer(compiled_grammar, 1, 1);
    const parser_string = await generateJSParser(compiled_grammar, recognizer_functions, meta, "", "return");

    await fsp.writeFile("./temp.js", parser_string);

    return new Function("ParserFactory", "memInit", parser_string,)(ParserFactoryNext, initializeUTFLookupTableNewPlus);
    //return await createAddHocParser(compiled_grammar, recognizer_functions, meta);
}

export async function compileJSParserStringFromGrammar(string_or_url, DEBUG = false, recognizer_type = "js") {

    const compiled_grammar = await compileGrammar(string_or_url);

    const { recognizer_functions, meta } = await buildRecognizer(compiled_grammar, 1, false);
    const parser_string = await generateJSParser(compiled_grammar, recognizer_functions, meta, "", "return");

    await fsp.writeFile("./temp.js", parser_string);
    return parser_string;
}


const cache = new Map();

export async function compileGrammar(string_or_url) {

    await URL.server();

    const url = URL.resolveRelative(string_or_url);

    let string = string_or_url;

    if (await url.DOES_THIS_EXIST())
        try {

            if (cache.has(url + ""))
                return cache.get(url + "");

            const grammar = await compileGrammarFromURI(url);

            cache.set(url + "", grammar);

            return grammar;

        } catch (e) { }

    return await compileGrammarFromString(string);
}