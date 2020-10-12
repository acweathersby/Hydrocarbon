import { Grammar, Production, ProductionBody, EOF_SYM } from "../types/grammar.js";
import { processClosure, Item, FOLLOW } from "../util/common.js";
import { GrammarParserEnvironment } from "../types/grammar_compiler_environment";
import { stmt, renderWithFormatting, JSNode, JSNodeType } from "@candlefw/js";
import { createReduceFunction, translateSymbolValue, getLexComparisonStringPeekNoEnv, getLexComparisonString } from "./utilities.js";
import fs from "fs";
import { LLProductionFunction } from "./LLProductionFunction";
import { LLItem } from "./LLItem";
import { getClosureTerminalSymbols } from "./getClosureTerminalSymbols.js";


function checkForLeftRecursion(p: Production, start_items: Item[], grammar: Grammar) {
    const closure_items = start_items.map(g => g.item);

    processClosure(closure_items, grammar);

    for (const c of closure_items.map(i => i.sym(grammar))) {
        if (c.type == "production")
            if (grammar[c.val] == p)
                return true;
    }

    return false;
}

function CopyLLItem(v: LLItem): LLItem {
    return <LLItem>{ body_index: v.body_index, off: v.off, len: v.len, item: v.item, closure: v.closure };
}

function LLItemToItem(v: LLItem): Item {
    return new Item(v.body_index, v.len, v.off, EOF_SYM);
}

function ItemToLLItem(i: Item, grammar: Grammar): LLItem {
    const c = [i];
    processClosure(c, grammar);
    return <LLItem>{ body_index: i.body, off: i.offset, len: i.len, item: i, closure: c };
}

function BodyToLLItem(b: ProductionBody, grammar: Grammar): LLItem {
    return ItemToLLItem(new Item(b.id, b.length, 0, EOF_SYM), grammar);
}

function renderItemSym(item: Item, grammar: Grammar): JSNode[] {
    const stmts = [];

    if (item.atEND) {
        const body = item.body_(grammar);
        const reduce_function = body?.reduce_function?.txt;

        if (reduce_function) {
            stmts.push(stmt(`return (${createReduceFunction(reduce_function)});`));
        } else
            stmts.push(stmt(`return (sym.pop())`));
    } else {
        const sym = item.sym(grammar);

        if (sym.type == "production")
            stmts.push(stmt(`sym.push($${grammar[sym.val].name}(lex, e))`));
        else {

            //Get skips from grammar - TODO get symbols from bodies / productions
            const skip_symbols = grammar.meta.ignore.flatMap(d => d.symbols);

            stmts.push(stmt(`sym.push(aaa(lex, e, [${skip_symbols.map(translateSymbolValue).join(",")}]));`));
        }
    }

    return stmts;
}

function renderItem(item: Item, grammar: Grammar): JSNode[] {
    const stmts = [];
    while (true) {
        stmts.push(...renderItemSym(item, grammar));
        if (item.atEND) break;
        item = item.increment();
    }
    return stmts;
}

function incrementClosure(closure: Item[], grammar: Grammar, amount = 1): Item[] {

    if (amount == 0) return closure;

    const completed_productions = new Set();
    // Starting at bottom, if the items symbol is a terminal
    // increment. If incrementing leads to the item being completed
    // add the item's production to the completed set.

    // If the item is at a production, if the production in the completed
    // site then increment the item. other do nothing.

    const new_partial_closure = [];

    for (const item of closure.map(i => i).reverse()) {
        if (item.atEND) continue;

        const sym = item.sym(grammar);

        if (sym.type == "production") {
            if (completed_productions.has(sym.val)) {
                const new_item = item.increment();

                if (new_item.atEND)
                    completed_productions.add(new_item.getProduction(grammar).id);
                else
                    new_partial_closure.unshift(new_item);
            } else
                new_partial_closure.unshift(item);
        } else {
            const new_item = item.increment();

            if (new_item.atEND)
                completed_productions.add(new_item.getProduction(grammar).id);
            else
                new_partial_closure.unshift(new_item);
        }
    }

    //take a new closure on this set to make sure we have all possible values.
    processClosure(new_partial_closure, grammar, [], 0, new Set(new_partial_closure.map(i => i.full_id)));

    if (--amount > 0)
        return incrementClosure(new_partial_closure, grammar, amount);

    return new_partial_closure;
}

function renderVals(trs: LLItem[], grammar: Grammar, peek_depth: number = 0) {

    const stmts = [];

    /* 
        Each item has a closure which yields transition symbols. 
        We are only interested in terminal transition symbols. 

        If a set of items have the same transition symbols then 
        they are likely the same and can be treated in one pass. 

        If the transition symbols differ, then the production will 
        need to be disambiguated until we find either matching
        transition symbols or 
    */
    if (trs.length == 1) {
        //Just complete the grammar symbols
        const item = LLItemToItem(trs[0]);
        stmts.push(...renderItem(item, grammar));
    } else {
        const sym_map = new Map();
        // sort into transition groups - groups gathered based on a single transition symbol
        const transition_groups: Map<string, LLItem[]> = trs.groupMap((i: LLItem) => {
            const syms = [];

            for (const sym of getClosureTerminalSymbols(i.closure, grammar)) {
                syms.push(sym.val);
                sym_map.set(sym.val, sym);
            }

            if (syms.length == 0 && i.item.atEND) {
                for (const sym of FOLLOW(grammar, i.item.getProduction(grammar).id).values()) {
                    syms.push(sym.val);
                    sym_map.set(sym.val, sym);
                }
            }

            return syms;
        });

        type TransitionGroup = {
            id: string;
            syms: Set<string>;
            trs: LLItem[];
        };

        // find transition combinations: groups that have the same bodies. 
        const group_maps: Map<string, TransitionGroup> = new Map();

        for (const [key, trs] of transition_groups.entries()) {

            const id = trs.map(i => LLItemToItem(i).id).sort().join("");

            if (!group_maps.has(id)) {

                group_maps.set(id, {
                    id,
                    syms: new Set(),
                    trs
                });
            }

            group_maps.get(id).syms.add(key);
        }

        const try_groups: Map<string, TransitionGroup[]> = new Map();

        // Determine if these groups are unique - This means 
        // Their ids do not contain ids of other groups. 
        // If they do, they need to be wrapped into try groups
        outer: for (const [id, group] of group_maps.entries()) {
            for (const [try_id, try_group] of try_groups.entries()) {
                const m = try_id.split("|").map(e => e + "|");
                if (group.trs.map(LLItemToItem).map(i => i.id).some(i => m.indexOf(i) >= 0)) {
                    const new_group = try_group.concat(group);
                    try_groups.delete(id);
                    try_groups.set(try_id + id, new_group);
                    continue outer;
                }
            }

            try_groups.set(id, [group]);
        }

        //Now create the necessary if statements with peek if depth > 0
        for (const try_group of try_groups.values()) {
            if (try_group.length > 1) {
                console.log("----------------------");
                //Make a try catch chain.
            } else {
                const
                    group = try_group[0],
                    trs = group.trs,
                    syms = [...group.syms.values()];

                let if_stmt;

                if (peek_depth > 0)
                    if_stmt = stmt(`if(${syms.map(s => getLexComparisonStringPeekNoEnv(sym_map.get(s), grammar)).join(" || ")}){}`);
                else
                    if_stmt = stmt(`if(${syms.map(s => getLexComparisonString(sym_map.get(s), grammar)).join(" || ")}){}`);

                const if_body = if_stmt.nodes[1].nodes;

                if (trs.length > 1) {
                    //Advance through each symbol until there is a difference
                    //When there is a difference create a peeking switch
                    let items: Item[] = trs.filter(_ => !!_).map(LLItemToItem).filter(_ => !!_), peek = peek_depth;

                    while (true) {
                        const sym = items[0].sym(grammar);
                        //All items agree
                        if (!items.reduce((r, i) => (i.atEND ? true : (((i.sym(grammar).val != sym.val)) || r)), false)) {
                            if_body.push(...renderItemSym(items[0], grammar));
                            items = items.map(i => i.increment()).filter(i => i);
                            peek = -1;
                        } else {
                            const new_trs = items.map(i => ItemToLLItem(i, grammar)).map(i => {
                                i.closure = incrementClosure(i.closure, grammar, peek + 1);
                                return i;
                            });

                            if_body.push(...renderVals(new_trs, grammar, peek + 1));
                            break;
                        };
                    }
                } else {
                    if_body.push(...renderVals(group.trs, grammar, 0));
                }

                stmts.push(if_stmt);
            }
        }
    }

    return stmts;
}

export function GetLLHybridFunctions(grammar: Grammar, env: GrammarParserEnvironment): LLProductionFunction[] {

    return grammar.map(p => {

        const fn = stmt(`function $${p.name}(lex, e){const sym = [];}`),
            body = fn.nodes[2].nodes,
            start_items: LLItem[] = p.bodies.map(b => BodyToLLItem(b, grammar));

        if (checkForLeftRecursion(p, start_items, grammar)) {
            return {
                refs: 0,
                id: p.id,
                L_RECURSION: true,
                fn: stmt(`\n\'Left recursion found in ${p.name}'\n`)
            };
        }

        body.push(...renderVals(start_items, grammar));

        if (body.slice(-1)[0].type != JSNodeType.ReturnStatement) {
            body.push(stmt(`return (sym.pop())`));
        }
        //body.push(stmt("lex.throw(`Could not parse token`)"));

        return {
            refs: 0,
            id: p.id,
            L_RECURSION: false,
            fn
        };
    });
}

