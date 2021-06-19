import { HCGParser } from "@candlelib/hydrocarbon/build/types/types/parser";
import URI from "@candlelib/uri";
import { HCG3Grammar } from "../types/grammar_nodes";
import {
    buildSequenceString,
    createUniqueSymbolSet
} from "./passes/common.js";
import { convertListProductions } from "./passes/convert_list_productions.js";
import { integrateImportedGrammars } from "./passes/import.js";
import { buildItemMaps } from "./passes/item_map.js";
import {
    loadGrammarFromFile,
    loadGrammarFromString
} from "./passes/load.js";
import { createJSFunctionsFromExpressions } from "./passes/process_code.js";
import { mergeProductions } from "./passes/merge_productions.js";
import { extractMetaSymbols } from "./passes/extract_meta_symbols.js";


class GrammarCompilationReport extends Error {
    constructor(errors: Error[]) {
        const messages = errors.map(e => "\n-----\n" + e.stack).join("\n----\n");

        super(messages);
    }
}

export async function compileGrammar(grammar: HCG3Grammar) {
    const errors: Error[] = [];

    try {
        await integrateImportedGrammars(grammar, errors);
        convertListProductions(grammar, errors);
        extractMetaSymbols(grammar, errors);
        //mergeProductions(grammar, errors); // Optional
        createJSFunctionsFromExpressions(grammar, errors);
        createUniqueSymbolSet(grammar, errors);
        buildSequenceString(grammar);
        buildItemMaps(grammar);
    } catch (e) {
        errors.push(e);
    }

    if (errors.length > 0)
        throw new GrammarCompilationReport(errors);

    return grammar;
}

export async function compileGrammarFromString(
    string: string,
    parser?: HCGParser
) {
    const grammar = loadGrammarFromString(string, parser);

    return await compileGrammar(grammar);
}


export async function compileGrammarFromURI(
    uri: URI,
    parser?: HCGParser
) {
    const grammar = await loadGrammarFromFile(uri, parser);

    return await compileGrammar(grammar);
}

