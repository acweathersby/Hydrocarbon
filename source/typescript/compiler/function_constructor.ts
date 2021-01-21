import { performance } from "perf_hooks";
import { EOF_SYM, Grammar } from "../types/grammar.js";
import { Production } from "../types/production";
import { RDProductionFunction } from "../types/rd_production_function";
import { RenderBodyOptions, ReturnType } from "../types/render_body_options";
import { SymbolType } from "../types/symbol_type";
import { getClosure } from "../utilities/closure.js";
import {
    rec_glob_lex_name,
    rec_state,
    rec_state_prod
} from "../utilities/global_names.js";
import { Item } from "../utilities/item.js";
import { getProductionFunctionName } from "../utilities/render_item.js";
import { SC } from "../utilities/skribble.js";
import { isSymAProduction } from "../utilities/symbol.js";

import { Helper } from "./helper.js";
import { processRecognizerStates } from "./states/process_recognizer_states.js";
import { completerSingleItemLeaf, defaultMultiItemLeaf, defaultSelectionClause, processProductionShiftStates } from "./states/default_state_build.js";
import { yieldNontermStates } from "./states/yield_nonterm_states.js";
import { yieldStates } from "./states/yield_states.js";


export const accept_loop_flag = SC.Variable("ACCEPT:boolean");

function generateRDOptions(
    grammar: Grammar,
    runner: Helper,
    /**
     * The production currently being processed.
     */
    production: Production,
    /**
     * Set of all production ids that are referenced within the function
     */
    lr_productions: Item[]
): RenderBodyOptions {
    return {
        grammar,
        runner,
        production,
        production_shift_items: lr_productions,
        extended_production_shift_items: [],
        called_productions: new Set(),
        leaf_productions: new Set(),
        cache: new Map(),
        active_keys: []
    };
}

function addClauseSuccessCheck(options: RenderBodyOptions): SC {
    const { production } = options;
    const condition = SC.Binary(rec_state_prod, "==", SC.Value(production.id));
    return SC.UnaryPre(SC.Return, SC.Call("assertSuccess", rec_glob_lex_name, rec_state, condition));
}

export function constructHybridFunction(production: Production, grammar: Grammar, runner: Helper): RDProductionFunction {

    const
        start = performance.now(),
        p = production,
        code_node = SC.Function(SC.Constant(getProductionFunctionName(production, grammar) + ":bool"), rec_glob_lex_name, rec_state);

    let items: Item[] = p.bodies.map(b => new Item(b.id, b.length, 0, EOF_SYM));


    try {

        const

            lr_productions = getClosure(items, grammar).filter(i => !i.atEND && i.sym(grammar).type == SymbolType.PRODUCTION),

            optionsA = generateRDOptions(
                grammar, runner,
                production,
                lr_productions
            ),

            genA = yieldStates(
                //Filter out items that are left recursive for the given production
                items.filter(i => {
                    const sym = i.sym(grammar);
                    if (sym && isSymAProduction(sym) && sym.val == production.id)
                        return false;
                    return true;
                }), optionsA, rec_glob_lex_name
            ),

            { code: initial_pass, prods: yielded_productions }
                = processRecognizerStates(optionsA, genA, defaultSelectionClause),

            optionsB = generateRDOptions(
                grammar, runner,
                production,
                lr_productions
            ),

            genB = yieldNontermStates(optionsB),

            { code: production_shift_pass }
                = processRecognizerStates(optionsB, genB, processProductionShiftStates(yielded_productions), defaultMultiItemLeaf, completerSingleItemLeaf);

        code_node.addStatement(
            runner.DEBUG
                ? SC.Value(`debug_stack.push("${production.name} START", { prod:state.prod, tx:str.slice(l.off, l.off + l.tl), ty:l.ty, tl:l.tl, utf:l.getUTF(), FAILED:state.getFAILED(),offset:l.off})`)
                : undefined,
            initial_pass,
            production_shift_pass,

            runner.DEBUG
                ? SC.Value(`debug_stack.push("${production.name} END", {prod:state.prod, tx:str.slice(l.off, l.off + l.tl), FAILED:state.getFAILED(), offset:l.off})`)
                : undefined,
            addClauseSuccessCheck(optionsA),
        );
        const end = performance.now();


        const annotation = SC.Expressions(SC.Comment(
            `
    production name: ${production.name}
    grammar index: ${production.id}
    bodies:\n\t${items.map(i => i.renderUnformattedWithProduction(grammar) + " - " + grammar.item_map.get(i.id).reset_sym.join(",")).join("\n\t\t")}
    compile time: ${((((end - start) * 1000) | 0) / 1000)}ms`));
        return {
            productions: new Set([...optionsA.called_productions.values(), ...optionsB.called_productions.values(), ...runner.referenced_production_ids.values()]),
            id: p.id,
            fn: (new SC).addStatement(
                (runner.ANNOTATED) ? annotation : undefined,
                code_node
            )
        };
    } catch (e) {

        const annotation = SC.Expressions(SC.Comment(
            `production name: ${production.name}
grammar index: ${production.id}
bodies:\n\t${items.map(i => i.renderUnformattedWithProduction(grammar) + " - " + grammar.item_map.get(i.id).reset_sym.join(",")).join("\n\t\t")}`));

        return {
            productions: new Set,
            id: p.id,
            fn: code_node.addStatement(annotation, SC.Expressions(SC.Comment(`Could Not Parse [${production.name}] in Recursive Descent Mode \n${e.message + e.stack + ""}\n`)))
        };
    }

}