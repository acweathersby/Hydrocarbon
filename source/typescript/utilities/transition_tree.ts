/* 
 * Copyright (C) 2021 Anthony Weathersby - The Hydrocarbon Parser Compiler
 * see /source/typescript/hydrocarbon.ts for full copyright and warranty 
 * disclaimer notice.
 */
import { performance } from "perf_hooks";
import {
    getSymbolsFromClosure,
    getUniqueSymbolName,
    getUnskippableSymbolsFromClosure,

    Sym_Is_A_Generic_Identifier,

    Sym_Is_A_Production,
    Sym_Is_A_Production_Token,
    Sym_Is_Defined_Identifier,
    Sym_Is_EOF,
    Sym_Is_Exclusive
} from "../grammar/nodes/symbol.js";
import { HCG3Grammar } from "../types/grammar_nodes";
import { Production } from "../types/production";
import { TokenSymbol } from "../types/symbol";
import { closure_group, TransitionTreeNode } from "../types/transition_tree_nodes";
import { getClosure, getFollowClosure } from "./closure.js";
import { getFollow } from "./follow.js";
import { Item } from "./item.js";
import { getProductionClosure } from "./production.js";

/**
 * Givin a set of root items, return a tree of nodes where each node represents a
 * transition on a symbol and a the collection of root items that still exist at
 * that node. Depth limited to some givin value to prevent infinite recursion.
 *
 * Default depth is 1.
 */
export function getTransitionTree(
    grammar: HCG3Grammar,
    root_items: Item[],
    lr_transition_items: Item[],
    max_tree_depth = 1,
    max_no_progress = 3,
    /**
     * Max amount of time the search process may take,
     * measured in milliseconds.
     *
     * Default is 150 milliseconds
     */
    max_time_limit = 150,
    depth: number = -1,
    closures: closure_group[] = null,
    len = 0,
    last_progress = 0,
    root_time = performance.now()
): { tree_nodes: TransitionTreeNode[]; clear: boolean; AMBIGUOUS: boolean; max_depth: number; } {

    if (!closures) {

        closures = root_items.map((i, index) => ({ final: 0, sym: null, index, closure: getClosure([i], grammar) }));

        const { AMBIGUOUS, clear, max_depth, tree_nodes } = getTransitionTree(grammar, root_items, lr_transition_items, max_tree_depth, max_no_progress, max_time_limit, 0, closures);

        return {
            AMBIGUOUS,
            clear,
            max_depth,
            tree_nodes: [
                {
                    item_ids: [],
                    unskippable: [],
                    depth: -1,
                    next: tree_nodes,
                    roots: root_items,
                    sym: null,
                    closure: [],
                    final_count: 0
                }
            ]
        };
    }

    if (performance.now() - root_time > max_time_limit)
        return { tree_nodes: [], clear: true, AMBIGUOUS: true, max_depth: depth };

    if (root_items.length == 1)
        return { tree_nodes: [], clear: true, AMBIGUOUS: false, max_depth: depth };

    if (depth > max_tree_depth)
        return { tree_nodes: [], clear: true, AMBIGUOUS: true, max_depth: depth };

    let
        GLOBAL_PROGRESS = false,
        CLEAR_REQUESTED = false,
        AMBIGUOUS = false,
        max_depth = depth;

    const
        closure_groups = closures.flatMap(cg => getClosureGroups(grammar, cg, lr_transition_items)),

        id_closure_groups = closure_groups.filter(g => Sym_Is_A_Generic_Identifier(g.sym)).setFilter(s => s.item_id),

        groups = closure_groups.group(cg => getUniqueSymbolName(cg.sym)),

        tree_nodes: TransitionTreeNode[] = [];

    for (const group of groups) {

        const INCLUDE_GENERIC_ID =
            Sym_Is_Defined_Identifier(group[0].sym)
            &&
            !Sym_Is_Exclusive(group[0].sym)
            &&
            id_closure_groups.length > 0;

        if (INCLUDE_GENERIC_ID) {
            group.push(...id_closure_groups);
        };

        let next = [];

        const
            unskippable = group.flatMap(g => g.unskippable),

            sym = group[0].sym,

            new_roots = group.map(cg => cg.index).setFilter().map(i => root_items[i]),

            progress = new_roots.length != len,

            quit = (depth - last_progress) >= Math.max(max_tree_depth - depth, max_no_progress),

            closure = group.filter(g => g.final == 0).flatMap(g => g.closure).filter(i => i.offset > 0).setFilter(i => i.id),

            starts = group.flatMap(g => g.starts ?? []).setFilter(i => i.id),

            curr_progress = progress ? depth : last_progress;

        if (progress)
            GLOBAL_PROGRESS = true;

        if (quit)
            CLEAR_REQUESTED = true;

        if (!quit && new_roots.length > 1) {

            const { tree_nodes, clear, AMBIGUOUS: A, max_depth: md }
                = getTransitionTree(
                    grammar,
                    root_items,
                    lr_transition_items,
                    max_tree_depth,
                    max_no_progress,
                    max_time_limit,
                    depth + 1,
                    group,
                    new_roots.length,
                    curr_progress,
                    root_time
                );

            AMBIGUOUS = AMBIGUOUS || A;

            if (clear)
                CLEAR_REQUESTED = true; else {
                max_depth = Math.max(md, max_depth + 1);
                next = tree_nodes;
            }
        }

        tree_nodes.push({
            last_progress: depth - last_progress,
            progress,
            sym: getUniqueSymbolName(sym, true),
            item_ids: group.map(i => i.item_id),
            unskippable,
            depth,
            closure,
            roots: new_roots,
            starts,
            next: next,
            final_count: group.reduce((r, c) => c.final + r, 0)
        });
    }

    if (CLEAR_REQUESTED && !GLOBAL_PROGRESS)
        return { tree_nodes: [], clear: true, AMBIGUOUS: true, max_depth: max_depth };

    return { tree_nodes, clear: false, AMBIGUOUS, max_depth: max_depth };
}
function getClosureGroups(
    grammar: HCG3Grammar,
    { index, closure, final, starts }: closure_group,
    lr_transition_items: Item[]
): closure_group[] {

    if (final > 1)
        return [];

    const
        group = [],
        unskippable: TokenSymbol[] = <any>getUnskippableSymbolsFromClosure(closure, grammar);

    for (const item of closure) {

        const sym = item.sym?.(grammar);

        if (item.atEND) {
            const new_closure = getFollowClosure([item], lr_transition_items, grammar);
            const production_id = closure[0].getProduction(grammar).id;

            if (new_closure.length == 0) {


                for (const sym of getFollow(production_id, grammar))
                    group.push({ sym, index, item_id: item.decrement().id, unskippable, closure: closure.slice(0, 1), final: final + 2 });

            } else {
                const new_group = getClosureGroups(
                    grammar,
                    { sym: null, item_id: item.id, unskippable, index, closure: new_closure, final: 0, starts },
                    lr_transition_items
                );


                group.push(...new_group);

                for (const sym of getFollow(production_id, grammar).filter(i => Sym_Is_EOF(i))) {
                    group.push({ sym, index, item_id: item.decrement().id, unskippable, closure: closure.slice(0, 1), final: final + 2 });
                }
            }
        } else if (Sym_Is_A_Production_Token(sym)) {

            for (const new_item of getProductionClosure(sym.val, grammar, true)) {

                const new_sym = new_item.sym(grammar);

                if (!Sym_Is_A_Production(new_item.sym(grammar))) {

                    const new_closure = new_item.increment() ? getClosure([new_item.increment()], grammar, true) : [new_item.increment()];
                    group.push({ sym: new_sym, index: index, item_id: item.id, unskippable, closure: new_closure.setFilter(i => i.id), final: final, starts: starts ? starts : [item] });
                }
            }
        } else if (!Sym_Is_A_Production(sym)) {

            const new_closure = incrementWithClosure(grammar, item, null);
            group.push({ sym, index: index, item_id: item.id, unskippable, closure: new_closure.setFilter(i => i.id), final: final, starts: starts ? starts : [item] });
        }
    }
    return group;
}
function incrementWithClosure(grammar: HCG3Grammar, item: Item, prod: Production): Item[] {
    return getClosure([item.increment()], grammar, true);
}

