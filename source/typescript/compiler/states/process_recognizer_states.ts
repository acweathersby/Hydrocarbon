import { bidirectionalTraverse, TraverseState } from "@candlefw/conflagrate";
import { GeneratorStateReturn, RecognizerState, TRANSITION_TYPE } from "../../types/recognizer_state.js";
import { RenderBodyOptions } from "../../types/render_body_options";
import { MultiItemReturnObject, SelectionClauseGenerator, SelectionGroup, SingleItemReturnObject } from "../../types/state_generating";
import { TokenSymbol } from "../../types/symbol.js";
import { Item } from "../../utilities/item.js";
import { SC } from "../../utilities/skribble.js";
import {
    Defined_Symbols_Occlude,
    Sym_Is_A_Generic_Identifier,
    Sym_Is_A_Generic_Number,
    Sym_Is_A_Generic_Symbol,
    Sym_Is_A_Generic_Type,
    Sym_Is_Defined_Characters,
    Sym_Is_Defined_Identifier,
    Sym_Is_Defined_Natural_Number,
    Sym_Is_EOF
} from "../../utilities/symbol.js";
import { default_resolveBranches } from "./default_branch_resolution.js";
import { default_resolveResolvedLeaf } from "./default_resolved_leaf_resolution.js";
import { default_resolveUnresolvedLeaves } from "./default_unresolved_leaves_resolution.js";



export function defaultGrouping(g) {
    return g.hash;
}
export function processRecognizerStates(
    options: RenderBodyOptions,
    states: RecognizerState[],
    branch_resolve_function:
        (gen: SelectionClauseGenerator, state: RecognizerState, items: Item[], level: number, options: RenderBodyOptions) => SC =
        default_resolveBranches,
    conflicting_leaf_resolve_function:
        (state: RecognizerState, states: RecognizerState[], options: RenderBodyOptions) => MultiItemReturnObject =
        default_resolveUnresolvedLeaves,
    leaf_resolve_function:
        (item: Item, group: RecognizerState, options: RenderBodyOptions) => SingleItemReturnObject =
        default_resolveResolvedLeaf,
    grouping_fn: (node: RecognizerState, level: number, peeking: boolean) => string = defaultGrouping
): GeneratorStateReturn {

    if (states.length == 0)
        return { code: new SC, prods: [], leaves: [], hash: "" };

    const finale_state = { ast: <RecognizerState>null };

    for (const { node: state, meta: { traverse_state, skip } } of bidirectionalTraverse<RecognizerState, "states">(<RecognizerState>{ states }, "states", true)
        .extract(finale_state)
        .makeSkippable()
    ) {

        if (state.PROCESSED) {
            skip();
            continue;
        }

        state.PROCESSED = true;

        switch (traverse_state) {

            case TraverseState.EXIT:

                const
                    states = state.states,
                    prods = states.flatMap(g => g.prods).setFilter(),
                    items = states.flatMap(g => g.items).setFilter(i => i.id),
                    filtered_states = states.filter(s => s.transition_type !== TRANSITION_TYPE.IGNORE && !!s.code),
                    WE_HAVE_UNRESOLVED_LEAVES = states.some(s => s.UNRESOLVED_LEAF);

                let
                    leaves = states.flatMap(g => g.leaves);

                //Set the transition type of any state with a null code property to IGNORE
                states.forEach(g => { if (!g.code) g.transition_type = TRANSITION_TYPE.IGNORE; });

                let
                    root: SC = null, hash = "ignore";

                if (filtered_states.length > 0) {

                    const virtual_state: RecognizerState = {
                        UNRESOLVED_LEAF: WE_HAVE_UNRESOLVED_LEAVES,
                        PROCESSED: false,
                        states: [],
                        symbols: [],
                        code: filtered_states[0].code,
                        hash: filtered_states[0].hash,
                        prods,
                        items,
                        completing: false,
                        peek_level: filtered_states[0].peek_level,
                        offset: filtered_states[0].offset,
                        transition_type: filtered_states[0].transition_type,
                        leaves
                    };

                    if (WE_HAVE_UNRESOLVED_LEAVES) {
                        ({ root, leaves } = conflicting_leaf_resolve_function(virtual_state, states, options));
                    } else {
                        root = branch_resolve_function(
                            traverseInteriorNodes(filtered_states, options, grouping_fn),
                            virtual_state,
                            items,
                            states[0].peek_level,
                            options
                        );
                    }
                    hash = root.hash();
                } else {
                    root = null;
                }

                state.leaves = leaves;
                state.prods = prods;
                state.code = root;
                state.hash = hash;

                break;

            case TraverseState.LEAF:

                if (state.items.length > 1)
                    throw new Error("Flow should not enter this block: Multi-item moved to group section");

                if (state.items.length == 0)
                    throw new Error("Flow should not enter this block: Multi-item moved to group section");

                const { leaf } = leaf_resolve_function(state.items[0], state, options);
                state.code = leaf.root;
                state.hash = leaf.hash;
                state.prods = leaf.prods;
                state.leaves = [leaf];

                break;

        }
    }

    const { code, prods, hash, leaves } = finale_state.ast;

    return { code, prods, hash, leaves };
}

function* traverseInteriorNodes(
    group: RecognizerState[],
    options: RenderBodyOptions,
    grouping_fn: (node: RecognizerState, level: number, peeking: boolean) => string
): SelectionClauseGenerator {

    const
        groups = group.group(g => grouping_fn(g, g.peek_level, g.peek_level >= 0)),

        sel_group: SelectionGroup[] = groups.map((group) => {

            const
                syms = group.flatMap(s => s.symbols),
                code = group[0].code,
                hash = group[0].hash,
                items = group.flatMap(g => g.items).setFilter(i => i.id),
                leaves = group.flatMap(g => g.leaves),
                yielders = group.map(i => i.transition_type).setFilter();

            return { leaves, transition_types: yielders, syms, code, items, hash, LAST: false, FIRST: false, prods: group.flatMap(g => g.prods).setFilter() };
        });
    let i = 0;
    for (const group of sel_group.sort((a, b) => {

        for (const sym_a of a.syms)
            for (const sym_b of b.syms)
                if (Defined_Symbols_Occlude(<TokenSymbol>sym_a, <TokenSymbol>sym_b))
                    return -1;


        return getGroupScore(a) - getGroupScore(b);
    })) {
        group.FIRST = i++ == 0;
        group.LAST = i == groups.length;
        yield group;
    }
}


function getGroupScore(a: SelectionGroup) {
    /** 
     * Classes: 
     * EOF                          :     Lowest Score Period?
     * 
     * DefinedSymbol DefinedNumeric :     0x00000001
     * 
     * DefinedIdentifier            :     0x00010000
     * 
     * Generic(Symbol | NL 
     *          | WS | NUM )        :     0x00100000
     * 
     * GenericIdentifier            :     0x01000000
     */

    let has_eof = -+a.syms.some(Sym_Is_EOF);

    let _0x000000001 = a.syms.filter(s => Sym_Is_Defined_Characters(s) || Sym_Is_Defined_Natural_Number(s)).length;
    let _0x000010000 = a.syms.filter(s => Sym_Is_Defined_Identifier(s)).length << 16;
    let _0x001000000 = a.syms.filter(s => Sym_Is_A_Generic_Type(s) && !Sym_Is_A_Generic_Identifier(s)).length << 24;
    let _0x010000000 = a.syms.filter(s => Sym_Is_Defined_Identifier(s)).length << 28;

    return (_0x000000001 | _0x000010000 | _0x001000000 | _0x010000000) * has_eof;
}