import { Grammar } from "../../types/grammar.js";
import { Production } from "../../types/production.js";
import { RecognizerState, TRANSITION_TYPE } from "../../types/recognizer_state.js";
import { RenderBodyOptions } from "../../types/render_body_options.js";
import { getClosure } from "../../utilities/closure.js";
import { Items_Have_The_Same_Active_Symbol, Item } from "../../utilities/item.js";
import { symIsAProduction, symIsAProductionToken } from "../../utilities/symbol.js";
import { getTransitionTree } from "../../utilities/transition_tree.js";
import { createRecognizerState } from "./create_recognizer_state.js";
import { getMaxOffsetOfItems, Items_Are_From_Same_Production, Leaves_Of_Transition_Contain_One_Root_Item as Every_Leaf_Of_TransitionTree_Contain_One_Root_Item, yieldStates } from "./yield_states.js";


export function processPeekStateLeaf(
    state: RecognizerState,
    options: RenderBodyOptions,
    offset: number = 0,
): void {

    const { grammar } = options;

    if (state.items.length > 0) {

        if (Items_From_Same_Production_Allow_Production_Call(state, options, offset))

            throw new Error("This case should have been handled in yieldStates");

        if (state.items.length > 1)

            if (Items_Have_The_Same_Active_Symbol(state.items, grammar))

                addSameActiveSymbolStates(state, options, offset);

            else if (No_Matching_Goto_In_Root_Production_Closure(state, options))

                if (State_Closure_Allows_Production_Call(state, options))

                    convertStateToProductionCall(state, offset);

                else
                    addRegularYieldStates(state, getClosure(state.closure, grammar), options, offset + 1);

            else

                if (
                    Every_Leaf_Of_TransitionTree_Contain_One_Root_Item(
                        getTransitionTree(grammar, state.items, options.goto_items, 10, 8).tree_nodes[0]
                    )
                )

                    addRegularYieldStates(state, state.items, options, offset);

                else

                    addBackTrackingStates(state, options, offset);

        else

            convertPeekStateToSingleItemState(state, options, offset);

    }
}

function addSameActiveSymbolStates(state: RecognizerState, options: RenderBodyOptions, offset: number) {

    if (Active_Symbol_Of_First_Item_Is_A_Production(state, options.grammar))
        state.transition_type = TRANSITION_TYPE.PEEK_PRODUCTION_SYMBOLS;

    addRegularYieldStates(state, state.items, options, offset + 1);
}

function Active_Symbol_Of_First_Item_Is_A_Production(state: RecognizerState, grammar: Grammar) {
    return symIsAProduction(state.items[0].sym(grammar));
}

function State_Closure_Allows_Production_Call({ closure }: RecognizerState, { grammar }: RenderBodyOptions) {
    return closure.every(i => i.offset == 0) && closure.map(i => i.getProduction(grammar).id).setFilter().length == 1;
}

function No_Matching_Goto_In_Root_Production_Closure(state: RecognizerState, options: RenderBodyOptions) {

    const { extended_goto_items } = options;

    return getMaxOffsetOfItems(state.items) == 0
        &&
        state.items.every(i => !extended_goto_items.some(s => s.body == i.body));
}

function Items_From_Same_Production_Allow_Production_Call(state: RecognizerState, options: RenderBodyOptions, offset: number) {
    const
        { production, grammar } = options,
        ITEMS_ARE_FROM_SAME_PRODUCTION = Items_Are_From_Same_Production(state.items, grammar),
        [first] = state.items,
        prod = first.getProduction(grammar);

    return offset == 0 && ITEMS_ARE_FROM_SAME_PRODUCTION && prod.id !== production.id;
}

function convertPeekStateToSingleItemState(state: RecognizerState, { grammar }: RenderBodyOptions, offset: number) {
    const { items } = state;

    const sym = items[0].sym(grammar);

    if (state.peek_level == 0) {
        state.transition_type = symIsAProduction(sym)
            ? TRANSITION_TYPE.ASSERT_PRODUCTION_SYMBOLS
            : TRANSITION_TYPE.CONSUME;

        if (!symIsAProduction(sym))
            state.transition_type = TRANSITION_TYPE.CONSUME;

        if (symIsAProductionToken(sym))
            state.symbols = [sym];

    } else {
        if (symIsAProduction(sym)) {
            state.transition_type = TRANSITION_TYPE.PEEK_PRODUCTION_SYMBOLS;
        }
    }

    state.offset = offset;
}

function convertStateToProductionCall(state: RecognizerState, offset: number) {

    state.items = state.closure.slice(0, 1);

    state.offset = offset;

    state.transition_type = TRANSITION_TYPE.ASSERT_PRODUCTION_SYMBOLS;
}

function addRegularYieldStates(state: RecognizerState, items: Item[], options: RenderBodyOptions, offset: number) {

    state.states.push(...yieldStates(items, options, offset + 1));

}

function addBackTrackingStates(state: RecognizerState, options: RenderBodyOptions, offset: number,) {

    const { items } = state;

    for (const items_with_same_symbol of items.group(i => i.sym(options.grammar))) {

        const backtracking_state = createRecognizerState(items, null, TRANSITION_TYPE.ASSERT, offset, state.peek_level);

        backtracking_state.states = yieldStates(items_with_same_symbol, options, offset);

        state.states.push(backtracking_state);
    }
}

