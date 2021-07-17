import { HCG3ProductionBody } from "@candlelib/hydrocarbon/build/types/types/grammar_nodes";
import { HCGParser } from "@candlelib/hydrocarbon/build/types/types/parser";
import URI from "@candlelib/uri";
import { HCG3Grammar } from "../types/grammar_nodes";
import {
    buildSequenceString,
    createUniqueSymbolSet,
    render
} from "./passes/common.js";
import { convertListProductions } from "./passes/convert_list_productions.js";
import { extractMetaSymbols } from "./passes/extract_meta_symbols.js";
import { integrateImportedGrammars } from "./passes/import.js";
import { buildItemMaps } from "./passes/item_map.js";
import {
    loadGrammarFromFile,
    loadGrammarFromString
} from "./passes/load.js";
import { createJSFunctionsFromExpressions } from "./passes/process_code.js";
import fs from "fs";

const fsp = fs.promises;

class GrammarCompilationReport extends Error {
    constructor(errors: Error[]) {
        const messages = errors.map(e => "\n-----\n" + e.stack).join("\n----\n");

        super(messages);
    }
}

function deduplicateProductionBodies(grammar: HCG3Grammar, error: Error[]) {

    for (const production of grammar.productions) {

        const valid_bodies = [];

        const signatures = new Set;

        for (const body of production.bodies) {

            const sig = render(Object.assign({}, body, <HCG3ProductionBody>{ reduce_function: null }));

            if (!signatures.has(sig)) {
                valid_bodies.push(body);
                signatures.add(sig);
            }
        }

        production.bodies = valid_bodies;
    }
}

export async function compileGrammar(grammar: HCG3Grammar) {
    const errors: Error[] = [];




    try {
        integrateImportedGrammars(grammar, errors);
        convertListProductions(grammar, errors);
        extractMetaSymbols(grammar, errors);
        deduplicateProductionBodies(grammar, errors);
        //mergeProductions(grammar, errors); // Optional
        createJSFunctionsFromExpressions(grammar, errors);
        createUniqueSymbolSet(grammar, errors);
        buildSequenceString(grammar);
        buildItemMaps(grammar);

        await fsp.writeFile("./temp.test", grammar.productions.map(p => render(p)).join("\n\n"));
        //console.log(grammar.productions.map(p => render(p)).join("\n"));
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

