/* 
 * Copyright (C) 2021 Anthony Weathersby - The Hydrocarbon Parser Compiler
 * see /source/typescript/hydrocarbon.ts for full copyright and warranty 
 * disclaimer notice.
 */
import {
    Defined_Symbols_Occlude,
    getSkippableSymbolsFromItems,
    getSymbolName,
    getUniqueSymbolName, Symbols_Occlude,
    Sym_Is_A_Generic_Identifier,
    Sym_Is_A_Generic_Number,
    Sym_Is_A_Generic_Symbol,
    Sym_Is_A_Production,
    Sym_Is_A_Production_Token,
    Sym_Is_A_Token,
    Sym_Is_Defined_Identifier,
    Sym_Is_Defined_Natural_Number,
    Sym_Is_Defined_Symbol
} from "../../grammar/nodes/symbol.js";
import { sk } from "../../skribble/skribble.js";
import { SKBlock, SKExpression, SKIf, SKMatch, SKReturn } from "../../skribble/types/node";
import { RenderBodyOptions } from "../../types/render_body_options";
import { Symbol, TokenSymbol } from "../../types/symbol.js";
import { TransitionClauseGenerator, TransitionGroup } from "../../types/transition_generating";
import { TransitionNode, TRANSITION_TYPE } from "../../types/transition_node.js";
import {
    addItemAnnotationToExpressionList,
    addSymbolAnnotationsToExpressionList,
    createBranchFunctionSk, createConsumeSk,
    createSkipCallSk, createSymbolMappingFunctionSk,
    getIncludeBooleansSk, getProductionFunctionNameSk
} from "../../utilities/code_generating.js";
import { createTransitionTypeAnnotation } from "../../utilities/create_transition_type_annotation.js";
import { Item } from "../../utilities/item.js";

/**
 * Handles intermediate state transitions. 
 */
export function default_resolveBranches(
    gen: TransitionClauseGenerator,
    state: TransitionNode,
    items: Item[],
    level: number,
    options: RenderBodyOptions,
    FORCE_ASSERTIONS: boolean = false
): SKExpression[] {

    const
        { grammar, helper: runner } = options,
        groups = [...gen],
        end_groups = groups.filter(group => group.transition_types[0] == TRANSITION_TYPE.ASSERT_END),
        number_of_end_groups = end_groups.length,
        all_syms = groups.flatMap(({ syms }) => syms).setFilter(getUniqueSymbolName),

        GROUPS_CONTAIN_SYMBOL_AMBIGUITY = Groups_Contain_Symbol_Ambiguity(groups);

    let root: SKExpression[] = [];


    if (groups.length == 1
        && !FORCE_ASSERTIONS
        && (groups[0].transition_types.includes(TRANSITION_TYPE.ASSERT_PRODUCTION_SYMBOLS)))
        return groups[0].code;

    if (options.helper.ANNOTATED) {
        addItemAnnotationToExpressionList(items, grammar, root);
        addSymbolAnnotationsToExpressionList(all_syms, grammar, root, "offset " + state.offset);
    }

    const peek_name = createPeekStatements(options,
        state,
        root,
        "l",
        "l",
        getSkippableSymbolsFromItems(items, grammar).filter(i => !all_syms.some(j => getSymbolName(i) == getSymbolName(j))),
        groups
    );

    if ((groups.length >= 5 || GROUPS_CONTAIN_SYMBOL_AMBIGUITY) && number_of_end_groups <= 1) {

        if (number_of_end_groups >= 1 && GROUPS_CONTAIN_SYMBOL_AMBIGUITY) {


            for (const end_group of end_groups) {

                const all_syms = groups.filter(g => g != end_group).flatMap(({ syms }) => syms).setFilter(getUniqueSymbolName);
                end_group.syms = end_group.syms.filter(s => all_syms.some(a => Defined_Symbols_Occlude(a, s)));
            }
        }

        createSwitchBlock(options, groups, peek_name, "l", root);

    } else

        root = createIfElseExpressions(options, state, groups, root, "l", peek_name, all_syms, FORCE_ASSERTIONS);


    return root;
}

/**
 * Checks for groups that have mutually occluding symbols
 */
function Groups_Contain_Symbol_Ambiguity(groups: TransitionGroup[]) {

    const masks: [number, number][] = groups.map(
        g => [
            ((+g.syms.some(Sym_Is_A_Generic_Identifier)) << 0)
            | ((+g.syms.some(Sym_Is_A_Generic_Number)) << 1)
            | ((+g.syms.some(Sym_Is_A_Generic_Symbol)) << 2),
            ((+g.syms.some(Sym_Is_Defined_Identifier)) << 0)
            | ((+g.syms.some(Sym_Is_Defined_Natural_Number)) << 1)
            | ((+g.syms.some(Sym_Is_Defined_Symbol)) << 2)
        ]
    );

    for (let i = 0; i < masks.length; i++) {
        for (let j = 0; j < masks.length; j++) {

            if (i == j) continue;

            const [genA, defA] = masks[i];
            const [genB, defB] = masks[j];

            if (
                ((genA & defB) && (genB & defA))
                || (genB & genA)
            ) return true;
        }
    }

    for (let i = 0; i < groups.length; i++) {
        for (let j = i; j < groups.length; j++) {
            if (j == i) continue;
            const groupA = groups[i];
            const groupB = groups[j];

            for (const symA of groupA.syms) {
                for (const symB of groupB.syms) {
                    if (Defined_Symbols_Occlude(symA, symB))
                        return true;
                }
            }
        }
    }

    return false;

}
/**
 * Used in cases of large number of symbols + transitions or occlusion conflicts
 * @param options 
 * @param groups 
 * @param lex_name 
 * @param root 
 */
function createSwitchBlock(
    options: RenderBodyOptions,
    groups: TransitionGroup[],
    peek_name: string,
    lex_name: string,
    root: SKExpression[]
) {
    const symbol_mappings: [number, Symbol][]

        = <any>groups.flatMap((g, i) => {

            let syms = g.syms;

            if (syms.some(Sym_Is_A_Generic_Identifier))
                syms = syms.filter(s => !Sym_Is_Defined_Identifier(s));
            return syms.map(s => [i, s]);
        }),

        fn_name = createSymbolMappingFunctionSk(
            options,
            lex_name,
            symbol_mappings.reverse()
        ),

        match = <SKMatch>sk`match ${fn_name}(${peek_name}, data): 1 : 1`,

        matches = match.matches;

    matches.length = 0;

    let DEFAULT_NOT_ADDED = true;

    for (let i = 0; i < groups.length; i++) {

        let { items, code, transition_types } = groups[i];

        const expr = code.slice(-1)[0];

        if (transition_types[0] == TRANSITION_TYPE.ASSERT_END && i == groups.length - 1) {
            DEFAULT_NOT_ADDED = false;
            matches.push((<SKMatch>sk`match 1 : default || ${i} : { ${(<SKBlock>{
                type: "block",
                expressions: code
            })}; break; }`).matches[0]);
        } else {
            matches.push((<SKMatch>sk`match 1 : ${i} : { ${(<SKBlock>{
                type: "block",
                expressions: code
            })}; break; };`).matches[0]);
        }
    }

    if (DEFAULT_NOT_ADDED)
        matches.push((<SKMatch>sk`match 1 : default : break`).matches[0]);

    root.push(match);
}

function createPeekStatements(
    options: RenderBodyOptions,
    state: TransitionNode,
    root: SKExpression[],
    lex_name: string,
    peek_name: string,
    skippable: TokenSymbol[],
    groups: TransitionGroup[],

) {
    if (Every_Transition_Does_Not_Require_A_Skip(groups))
        return lex_name;

    if (state.peek_level >= 0) {

        if (state.offset > 0 && state.peek_level == 0) {
            const skip = createSkipCallSk(skippable, options, lex_name, false);
            if (skip) root.push(skip);
        } else if (state.peek_level >= 1) {

            peek_name = "pk";

            if (state.peek_level == 1)
                root.push(<SKExpression>sk`[mut] pk:Lexer = ${lex_name}.copyInPlace()`);


            const skip = createSkipCallSk(skippable, options, "pk.next(data)", true);

            if (skip) root.push(skip);
            else root.push(<SKExpression>sk`pk.next(data)`);
        }
    } else if (state.offset == 1 && options.scope == "GOTO") {
        const skip = createSkipCallSk(skippable, options, "l", false);
        if (skip) root.push(skip);
    } else if (state.peek_level < 0) {
        //Post peek consume
        const skip = createSkipCallSk(skippable, options, "l", false);
        if (skip) root.push(skip);
    }

    return peek_name;
}

function Every_Transition_Does_Not_Require_A_Skip(groups: TransitionGroup[]) {
    return groups.every(g => g.transition_types.every(t => t == TRANSITION_TYPE.POST_PEEK_CONSUME || t == TRANSITION_TYPE.ASSERT_END));
}

function createIfElseExpressions(
    options: RenderBodyOptions,
    state: TransitionNode,
    groups: TransitionGroup[],
    root: SKExpression[],
    lex_name: string,
    peek_name: string,
    all_syms: Symbol[],
    FORCE_ASSERTIONS: boolean,
): SKExpression[] {

    let expressions = root, last_if: SKIf = null;

    let previous_transition: TRANSITION_TYPE;

    function addIf(_if: SKIf) {

        if (last_if) {
            last_if.else = _if;
        } else {
            expressions.push(_if);
        }
        last_if = _if;
    }

    const { grammar, helper: runner } = options;

    for (let i = 0; i < groups.length; i++) {


        const
            group = groups[i],

            { syms, transition_types, code, items, leaves } = group,
            complement_symbols = groups.filter((l, j) => j > i).flatMap(g => g.syms).setFilter(getUniqueSymbolName);

        let assertion_boolean: SKExpression = null;

        const
            transition_type: TRANSITION_TYPE = transition_types[0],
            FIRST_SYMBOL_IS_A_PRODUCTION = Sym_Is_A_Production(syms[0]),
            FIRST_SYMBOL_IS_A_PRODUCTION_TOKEN = false; //Sym_Is_A_Production_Token(syms[0]);

        switch (transition_type) {

            case TRANSITION_TYPE.POST_PEEK_CONSUME:

                code.unshift(...expressions);

                if (options.helper.ANNOTATED)
                    code.unshift(createTransitionTypeAnnotation(options, transition_types));

                code.unshift(createConsumeSk(lex_name));
                expressions = code;
                break;

            case TRANSITION_TYPE.ASSERT_END:
                const r_syms = groups.slice(i + 1).flatMap(g => g.syms).setFilter(getUniqueSymbolName);

                /**
                 * Completed Items are tricky. They don't represent actual consumption of 
                 * tokens, but rather must assert that a set of tokens FOLLOW the completed
                 * item. This set can easily occlude other symbols and lead to incorrect 
                 * recognition. 
                 * 
                 * There are several ways to remedy this. One is to make completed 
                 * items the last item evaluated within an if-else expression block. 
                 * Since completed items are reducible by default no matter the state
                 * of the token stream, this allows the last block to be simply and else
                 * statement. 
                 * 
                 * This is not an option if there are multiple completed items, as there will be
                 * at least one completed item whose set of follow tokens must be evaluated
                 * to remove ambiguity.
                 * 
                 * Shift has priority over Reduce: if there are defined symbols that 
                 */

                if (i == groups.length - 1) {
                    addIf({
                        type: "block",
                        expressions: code
                    });
                } else {
                    const occlusion_candidates = r_syms.filter(r => syms.some(s => Defined_Symbols_Occlude(s, r)));

                    const mapped_symbols = [].concat(syms.map(s => [1, s]), occlusion_candidates.map(r => [0, r]));


                    const bool_fn = createSymbolMappingFunctionSk(
                        options,
                        lex_name,
                        mapped_symbols
                    );

                    assertion_boolean = <SKExpression>sk`${bool_fn}(${peek_name}, data) == 1`;

                    addIf(createIfStatementTransition(options, group, code, assertion_boolean, FORCE_ASSERTIONS, "Assert End"));
                }
                break;

            case TRANSITION_TYPE.ASSERT_PRODUCTION_CALL:

                const production = grammar.productions[group.items[0].sym(grammar).val];

                options.called_productions.add(<number>production.id);

                const call_name = createBranchFunctionSk(code, options);
                expressions.push(<SKExpression>sk`pushFN(data, &> ${call_name})`);
                expressions.push(<SKExpression>sk`pushFN(data, &>  ${getProductionFunctionNameSk(production, grammar)})`);
                expressions.push(<SKReturn>sk`return:data.rules_ptr`);
                leaves.forEach(leaf => leaf.INDIRECT = true);

                if (code.slice(-1)[0].type !== "return")
                    code.push(<SKExpression>sk`return:-1`);

                break;

            case TRANSITION_TYPE.ASSERT:
            case TRANSITION_TYPE.ASSERT_PEEK:
            case TRANSITION_TYPE.ASSERT_PEEK_VP:
            case TRANSITION_TYPE.PEEK_UNRESOLVED:
            case TRANSITION_TYPE.PEEK_PRODUCTION_SYMBOLS:
            case TRANSITION_TYPE.ASSERT_PRODUCTION_SYMBOLS:

                if (FIRST_SYMBOL_IS_A_PRODUCTION && !FIRST_SYMBOL_IS_A_PRODUCTION_TOKEN) throw new Error("WTF");

                const ALLOW_GEN_OCCLUSION = [
                    TRANSITION_TYPE.PEEK_PRODUCTION_SYMBOLS,
                    TRANSITION_TYPE.ASSERT_PRODUCTION_SYMBOLS
                ].includes(transition_type);

                assertion_boolean = getIncludeBooleansSk(<TokenSymbol[]>syms, options, peek_name, <TokenSymbol[]>complement_symbols, ALLOW_GEN_OCCLUSION);

                let scr = code;

                if (items.length == 1) {
                    scr = [];
                    const nc = [];


                    const continue_name = createBranchFunctionSk(nc, options);
                    const call_name = createBranchFunctionSk(code, options);


                    scr.push(<SKExpression>sk`pushFN(data, &> ${continue_name})`);
                    scr.push(<SKExpression>sk`return: ${call_name}(l, data, db, state, prod, prod_start)`);


                    leaves[0].leaf.push(<SKReturn>sk`return:prod_start`);

                    leaves.forEach(l => l.transition_type == TRANSITION_TYPE.IGNORE);
                    leaves[0].leaf = nc;

                    leaves[0].INDIRECT = true;
                    leaves[0].transition_type = TRANSITION_TYPE.ASSERT;


                    if (code.slice(-1)[0].type !== "return")
                        code.push(<SKExpression>sk`return:-1`);
                }

                if (
                    i == groups.length - 1
                    &&
                    groups.length > 1
                    &&
                    Group_Allows_Unchecked(group, state, options)
                ) {
                    addIf({
                        type: "block",
                        expressions: scr
                    });
                } else {

                    addIf(createIfStatementTransition(options, group, scr, assertion_boolean, FORCE_ASSERTIONS, "Assert"));
                }


                break;

            case TRANSITION_TYPE.ASSERT_CONSUME:


                assertion_boolean = getIncludeBooleansSk(<TokenSymbol[]>syms, options, lex_name, <TokenSymbol[]>complement_symbols);

                code.unshift(createConsumeSk("l"));

                addIf(createIfStatementTransition(options, group, code, assertion_boolean, FORCE_ASSERTIONS, "Assert Consume"));

                break;

            case TRANSITION_TYPE.IGNORE: break;
        }

        previous_transition = transition_type;
    }

    return expressions;

}

function Group_Allows_Unchecked(group: TransitionGroup, state: TransitionNode, options: RenderBodyOptions): boolean {

    const { syms, transition_types, code, items, leaves } = group;

    const [transition_type] = transition_types;

    return (
        transition_type == TRANSITION_TYPE.PEEK_PRODUCTION_SYMBOLS
        ||
        transition_type == TRANSITION_TYPE.ASSERT_PRODUCTION_SYMBOLS
        ||
        (
            transition_type == TRANSITION_TYPE.ASSERT_PEEK
            &&
            state.peek_level >= 1
        )
    )
        &&
        (options.scope != "GOTO"
            || state.offset > 1);
}



function createIfStatementTransition(
    options: RenderBodyOptions,
    group: TransitionGroup,
    modified_code: SKExpression[],
    boolean_assertion: SKExpression,
    FORCE_ASSERTIONS: boolean,
    ShiftComment: string = ""
): SKIf {

    const { grammar, helper: runner } = options;
    let { syms, items, LAST, FIRST, transition_types } = group;

    const transition_type: TRANSITION_TYPE = transition_types[0];

    let if_stmt = <SKIf>sk`if ${boolean_assertion}: ${(<SKBlock>{
        type: "block",
        expressions: modified_code
    })

        }`;

    //addSymbolAnnotationsToExpressionList(syms, grammar, modified_code, ShiftComment);

    const SKIP_BOOL_EXPRESSION = (!FORCE_ASSERTIONS || transition_type == TRANSITION_TYPE.ASSERT_END)
        && (LAST && !FIRST)
        && (
            // transition_type == TRANSITION_TYPE.ASSERT_PRODUCTION_SYMBOLS
            //|| transition_type == TRANSITION_TYPE.ASSERT
            //|| transition_type == TRANSITION_TYPE.PEEK_PRODUCTION_SYMBOLS
            //|| transition_type == TRANSITION_TYPE.PEEK_UNRESOLVED
            //|| transition_type == TRANSITION_TYPE.ASSERT_PEEK
            //|| transition_type == TRANSITION_TYPE.ASSERT_PEEK_VP
            //|| 
            transition_type == TRANSITION_TYPE.ASSERT_END
        );

    return if_stmt;
}


