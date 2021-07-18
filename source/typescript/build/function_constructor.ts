/* 
 * Copyright (C) 2021 Anthony Weathersby - The Hydrocarbon Parser Compiler
 * see /source/typescript/hydrocarbon.ts for full copyright and warranty 
 * disclaimer notice.
 */
import { performance } from "perf_hooks";
import { Sym_Is_A_Production } from "../grammar/nodes/symbol.js";
import { sk } from "../skribble/skribble.js";
import { SKExpression, SKFunction, SKPrimitiveDeclaration } from "../skribble/types/node.js";
import { HCG3Grammar, HCG3Production } from "../types/grammar_nodes.js";
import { RDProductionFunction } from "../types/rd_production_function";
import { RenderBodyOptions } from "../types/render_body_options";
import { Symbol } from "../types/symbol.js";
import { Leaf, TRANSITION_TYPE } from "../types/transition_node.js";
import { collapseBranchNamesSk, createBranchFunctionSk, getProductionFunctionName } from "../utilities/code_generating.js";
import { const_EMPTY_ARRAY } from "../utilities/const_EMPTY_ARRAY.js";
import { Item, ItemIndex } from "../utilities/item.js";
import { getProductionClosure } from "../utilities/production.js";
import { renderItem } from "../utilities/render_item.js";
import { createVirtualProductions } from "../utilities/virtual_productions.js";
import { default_resolveBranches } from "./branch_resolution/default_branch_resolution.js";
import { addClauseSuccessCheck, resolveGOTOBranches } from "./branch_resolution/goto_resolution.js";
import { Helper } from "./helper.js";
import { addLeafStatements, addVirtualProductionLeafStatements } from "./transitions/add_leaf_statements.js";
import { processTransitionNodes } from "./transitions/process_transition_nodes.js";
import { yieldGOTOTransitions } from "./transitions/yield_goto_transitions.js";
import { yieldTransitions } from "./transitions/yield_transitions.js";
export function constructHybridFunction(production: HCG3Production, grammar: HCG3Grammar, runner: Helper): RDProductionFunction {

    const

        rd_fn_name = <SKPrimitiveDeclaration>sk`[priv] ${getProductionFunctionName(production, grammar)}:u32`,

        goto_fn_name = <SKPrimitiveDeclaration>sk`[priv] ${getProductionFunctionName(production, grammar)}_goto:u32`,

        start = performance.now(),

        RD_function = <SKFunction>sk`
        fn ${getProductionFunctionName(production, grammar)}:i32(l:__Lexer$ref,data:__ParserData$ref, db:__ParserDataBuffer$ref, state:u32, prod:u32, prod_start:u32){ ${runner.ANNOTATED ? "" : ""} prod_start = data.rules_ptr; }`,

        GOTO_function = <SKFunction>sk`
        fn ${getProductionFunctionName(production, grammar)}_goto:i32(l:__Lexer$ref,data:__ParserData$ref, db:__ParserDataBuffer$ref, state:u32, prod:u32, prod_start:u32){ ${runner.ANNOTATED ? "" : ""} }`,

        { RDOptions, GOTO_Options, RD_fn_contents, GOTO_fn_contents }
            = compileProductionFunctions(grammar, runner, [production]);

    RD_function.expressions.push(...RD_fn_contents, <SKExpression>sk`return:-1`);

    GOTO_function.expressions.push(...GOTO_fn_contents);

    addLeafStatements(
        RD_fn_contents,
        GOTO_fn_contents,
        rd_fn_name,
        goto_fn_name.name,
        RDOptions,
        GOTO_Options);

    collapseBranchNamesSk(RDOptions);
    collapseBranchNamesSk(GOTO_Options);

    if (!GOTO_Options.NO_GOTOS)
        GOTO_function.expressions.push(addClauseSuccessCheck(RDOptions));

    return {
        productions: new Set([...RDOptions.called_productions.values(), ...GOTO_Options.called_productions.values(), ...runner.referenced_production_ids.values()]),
        id: production.id,
        fn: [
            RD_function,
            GOTO_Options.NO_GOTOS ? undefined : GOTO_function,
            null//ReduceFunction
        ],
        RENDER: false
    };
}


export function createVirtualProductionSequence(
    options: RenderBodyOptions,
    items: Item[],
    expected_symbols: Symbol[] = [],
    out_leaves: Leaf[],
    out_prods: number[] = [],
    /**
     * If true, creates a new, globally consistent function
     * and creates a call to this function in the current
     * context of the output code. 
     * 
     * Otherwise, the virtual production code will be directly 
     * inserted into the current code context.
     * 
     */
    ALLOCATE_FUNCTION: boolean = false,
    transition_type: TRANSITION_TYPE = TRANSITION_TYPE.ASSERT_END,
    CLEAN = false
): SKExpression[] {
    const
        out: SKExpression[] = [],
        { grammar, helper } = options,
        { links: virtual_links, V_PRODS_ALREADY_EXIST } = createVirtualProductions(items, options);

    if (V_PRODS_ALREADY_EXIST)
        throw new Error("Virtual productions already exists, interminable loop detected");

    if (options.VIRTUAL_LEVEL > 8)
        throw new Error("Virtual production level too high");

    const { RDOptions, GOTO_Options, RD_fn_contents, GOTO_fn_contents }
        = compileProductionFunctions(
            grammar,
            helper,
            Array.from(virtual_links.values()).map(({ p }) => p),
            expected_symbols,
            (CLEAN ? 1 : options.VIRTUAL_LEVEL + 1)
        ),

        rd_virtual_name = createBranchFunctionSk(RD_fn_contents, RDOptions),

        goto_virtual_name = createBranchFunctionSk(GOTO_fn_contents, GOTO_Options),

        gen = addVirtualProductionLeafStatements(
            RD_fn_contents,
            GOTO_fn_contents,
            rd_virtual_name,
            goto_virtual_name,
            RDOptions,
            GOTO_Options,
            virtual_links
        );

    for (let { item_id, leaf, prods } of gen) {

        const item = grammar.item_map.get(item_id).item;

        let leaf_node = leaf;

        prods = [item.getProduction(grammar).id];

        let original_prods = prods;

        if (options.VIRTUAL_LEVEL == 0) {

            item[ItemIndex.offset] = item[ItemIndex.length];

            ({ prods, leaf_node, original_prods } = renderItem(leaf, item, options));
        }

        out_prods.push(...prods);

        out_leaves.push({
            prods: prods,
            root: leaf,
            leaf: leaf_node,
            original_prods,
            hash: "----------------",
            transition_type: TRANSITION_TYPE.ASSERT
        });
    }

    if (options.helper.ANNOTATED) {
        out.push(
            <SKExpression>sk`"-------------VPROD-------------------------"`,
            <SKExpression>sk`"${items.map(i => i.renderUnformattedWithProduction(grammar)).join("\n")}"`,
        );
    }

    out.push(
        <SKExpression>sk`pushFN(data, &> ${rd_virtual_name}, 0)`,
        <SKExpression>sk`return:0`,
    );

    collapseBranchNamesSk(RDOptions);

    collapseBranchNamesSk(GOTO_Options);

    return out;
}

export function compileProductionFunctions(
    grammar: HCG3Grammar,
    runner: Helper,
    productions: HCG3Production[],
    /** 
     * Only include transitions with the
     * with the matching symbols. Only applies
     * to the first transition encountered.
     */
    filter_symbols: Symbol[] = const_EMPTY_ARRAY,
    IS_VIRTUAL: number = 0
) {
    //if (IS_VIRTUAL > 32) throw new Error("Virtual production depth is too high");

    const

        initial_items = getProductionItemsThatAreNotRightRecursive(productions, grammar),

        RDOptions = createBuildOptions(
            grammar, runner,
            productions,
            IS_VIRTUAL
        ),

        rd_nodes = yieldTransitions(
            //Filter out items that are left recursive for the given production
            initial_items,
            RDOptions,
            0,
            filter_symbols
        ),

        { code: RD_fn_contents, prods: completed_productions, leaves: rd_leaves }
            = processTransitionNodes(RDOptions, rd_nodes, default_resolveBranches),

        GOTO_Options = createBuildOptions(
            grammar, runner,
            productions,
            IS_VIRTUAL,
            "GOTO"
        ),

        { code: GOTO_fn_contents, leaves: goto_leaves } = processTransitionNodes(
            GOTO_Options,
            yieldGOTOTransitions(GOTO_Options, completed_productions),
            resolveGOTOBranches
        );

    RDOptions.leaves = rd_leaves;
    GOTO_Options.leaves = goto_leaves;

    return { RDOptions, GOTO_Options, RD_fn_contents, GOTO_fn_contents };
}
export function createBuildOptions(
    grammar: HCG3Grammar,
    runner: Helper,
    /**
     * The production currently being processed.
     */
    productions: HCG3Production[],
    IS_VIRTUAL: number = 0,
    scope: "RD" | "GOTO" = "RD"
): RenderBodyOptions {
    return {
        scope,
        grammar,
        helper: runner,
        productions: productions,
        production_ids: productions.map(p => p.id),
        goto_items: productions.flatMap(
            p => getGotoItemsFromProductionClosure(p, grammar)
        ).setFilter(i => i.id),
        extended_goto_items: [],
        called_productions: new Set(),
        leaf_productions: new Set(),
        active_keys: [],
        leaves: [],
        branches: [],
        VIRTUAL_LEVEL: IS_VIRTUAL,
        NO_GOTOS: false,
        global_production_items: [...grammar.item_map.values()].map(i => i.item).filter(i => !i.atEND && Sym_Is_A_Production(i.sym(grammar)))
    };
}

export function getGotoItemsFromProductionClosure(production: HCG3Production, grammar: HCG3Grammar): Item[] {
    return getProductionClosure(production.id, grammar).filter(i => !i.atEND && Sym_Is_A_Production(i.sym(grammar)));
}

export function getStartItemsFromProduction(production: HCG3Production): Item[] {
    return production.bodies.map(b => new Item(b.id, b.length, 0));
}

export function getProductionItemsThatAreNotRightRecursive(productions: HCG3Production[], grammar: HCG3Grammar): Item[] {
    return productions.flatMap(p => getStartItemsFromProduction(p).filter(i => {

        const sym = i.sym(grammar);

        if (sym && Sym_Is_A_Production(sym) && sym.val == p.id)
            return false;

        return true;
    })).setFilter(i => i.id);
}