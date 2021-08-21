/* 
 * Copyright (C) 2021 Anthony Weathersby - The Hydrocarbon Parser Compiler
 * see /source/typescript/hydrocarbon.ts for full copyright and warranty 
 * disclaimer notice.
 */
import { sk } from "../../skribble/skribble.js";
import { SKExpression, SKReference, SKReturn } from "../../skribble/types/node";
import { RenderBodyOptions } from "../../types/render_body_options";
import { TRANSITION_TYPE } from "../../types/transition_node.js";
import { processProductionChain } from "../../utilities/process_production_reduction_sequences.js";
import { VirtualProductionLinks } from "../../utilities/virtual_productions.js";
import { addClauseSuccessCheck } from "../branch_resolution/goto_resolution.js";


const SC = null;

/**
 * Adds code to end nodes
 *
 * If a production shift section is present, then leaf nodes in RD
 * section are appended  with a prod assignment. Additionally, a
 * local prod variable is declared at the head of the production
 * function, and a call to assertSuccess is appended to the tail.
 *
 * If the production shift section is absent then leaf nodes simply
 * return `true`. A `return false` statement is appended to the end
 * of the production function;
 *
 * *leaf state* - Any sequence of transitions yields a
 * single item
 *
 * @param RD_fn_contents - The root skribble node for the production function
 * @param RDOptions - Options from the RD yielder
 * @param GOTO_Options - Options from the GOTO yielder
 */

export function addLeafStatements(
    RD_fn_contents: SKExpression[],
    GOTO_fn_contents: SKExpression[],
    rd_fn_name: SKReference,
    goto_fn_name: SKReference,
    RDOptions: RenderBodyOptions,
    GOTO_Options: RenderBodyOptions) {
    const
        { leaves: rd_leaves, production_ids, grammar } = RDOptions,
        { leaves: goto_leaves, NO_GOTOS, goto_items } = GOTO_Options;


    let GOTOS_FOLDED = false;

    for (const rd_leaf of rd_leaves) {
        let { leaf, prods, original_prods, EMPTY } = rd_leaf;

        //@ts-ignore
        if (rd_leaf.SET)
            continue;

        //@ts-ignore
        rd_leaf.SET = true;
        if (NO_GOTOS) {

            prods = processProductionChain(leaf, GOTO_Options, original_prods);

            leaf.push(<SKReturn>sk`return:${prods[0]}`/*<SKExpression>sk`return:${prods[0]}`*/);

        } else {

            if (!EMPTY) {
                leaf.push(<SKExpression>sk`return : ${goto_fn_name}(state, db, ${prods[0]})`);
            } else {
                leaf.push(<SKExpression>sk`return : ${prods[0]}`);
            }
        }
    }

    if (!NO_GOTOS) {

        const recursive_production_ids = new Set(goto_items.map(i => grammar.bodies[i.body].production.id));

        for (const goto_leaf of goto_leaves) {

            let { leaf, prods, transition_type, INDIRECT, EMPTY } = goto_leaf;

            //@ts-ignore
            if (goto_leaf.SET || transition_type == TRANSITION_TYPE.IGNORE) {

                // If here, then most likely the parser has transitioned on a production
                // outside the scope of the originating production. We should immediately
                // return the original productions value, as at this point we are no
                // longer processing symbols that can be a part of the originating 
                // production.
                leaf.push(<SKExpression>sk`return:${prods[0]}`);
                continue;
            }

            //@ts-ignore
            goto_leaf.SET = true;

            if (
                transition_type == TRANSITION_TYPE.ASSERT_END
                && 
                production_ids.includes(prods[0])
            ) {
                if (!INDIRECT) {
                    leaf.push(<SKExpression>sk`prod=${prods[0]}`);
                    leaf.push(<SKExpression>sk`continue`);
                } else if (recursive_production_ids.has(prods[0])) {
                    leaf.push(<SKExpression>sk`return : ${goto_fn_name}(state, db, ${prods[0]})`);
                } else {
                    leaf.push(<SKExpression>sk`return:${prods[0]}`);
                }
            } else if (
                transition_type == TRANSITION_TYPE.ASSERT_END
                &&
                !INDIRECT
            ) {
                leaf.push(<SKExpression>sk`prod=${prods[0]}`);
                leaf.push(<SKExpression>sk`continue`);
            } else {
                leaf.push(<SKExpression>sk`return : ${goto_fn_name}(state, db, ${prods[0]})`);
            }
        }
    }

    if (GOTOS_FOLDED)
        RD_fn_contents.push(addClauseSuccessCheck(RDOptions));
    else {
        if (RD_fn_contents[RD_fn_contents.length - 1]?.type !== "return")
            RD_fn_contents.push(<SKExpression>sk`return:-1`);
    }
}

/**
 * Used to grab production information from intermediate RD/GOTO passes
 *
 * @param RD_fn_contents - The root skribble node for the production function
 * @param RDOptions - Options from the RD yielder
 * @param GOTO_Options - Options from the GOTO yielder
 */

export function* addVirtualProductionLeafStatements(
    RD_fn_contents: SKExpression[],
    GOTO_fn_contents: SKExpression[],
    rd_fn_name: SKReference,
    goto_fn_name: SKReference,
    RDOptions: RenderBodyOptions,
    GOTO_Options: RenderBodyOptions,
    v_map?: VirtualProductionLinks
): Generator<{ item_id: string, leaf: SKExpression[]; prods: number[]; }> {
    const
        { leaves: rd_leaves, production_ids } = RDOptions,
        { leaves: goto_leaves, NO_GOTOS } = GOTO_Options,
        p_map = new Map([...v_map.entries()].map(([id, { p, i }]) => [p.id, id]));

    let GOTOS_FOLDED = false;

    for (const rd_leaf of rd_leaves) {
        const { leaf, prods } = rd_leaf;

        //@ts-ignore
        if (rd_leaf.SET)
            continue;

        //@ts-ignore
        rd_leaf.SET = true;

        if (p_map.has(prods[0])) {
            yield { item_id: p_map.get(prods[0]), leaf, prods };
        } else if (NO_GOTOS) {
            leaf.push(<SKExpression>sk`return:${prods[0]}`);
        } else {
            leaf.push(<SKExpression>sk`return : ${goto_fn_name}(state, db, ${prods[0]})`);
        }
    }

    if (!NO_GOTOS)
        for (const goto_leaf of goto_leaves) {

            const { leaf, prods, transition_type, INDIRECT } = goto_leaf;

            //@ts-ignore
            if (goto_leaf.SET || transition_type == TRANSITION_TYPE.IGNORE) {

                console.log(leaf);
                continue;
            }

            //@ts-ignore
            goto_leaf.SET = true;

            if (p_map.has(prods[0])) {
                yield { item_id: p_map.get(prods[0]), leaf, prods };
            } else if (
                transition_type == TRANSITION_TYPE.ASSERT_END
                && production_ids.includes(prods[0])
            ) {
                if (production_ids.some(p_id => goto_leaf.keys.includes(p_id))) {
                    leaf.push(<SKExpression>sk`prod=${prods[0]}`);
                    leaf.push(<SKExpression>sk`continue`);
                } else
                    leaf.push(<SKExpression>sk`return:${prods[0]}`);
            } else if (transition_type == TRANSITION_TYPE.ASSERT_END
                && !INDIRECT
            ) {
                leaf.push(<SKExpression>sk`prod=${prods[0]}`);
                leaf.push(<SKExpression>sk`continue`);
            } else {
                leaf.push(<SKExpression>sk`return : ${goto_fn_name}(state, db, ${prods[0]})`);
            }

        }

    if (GOTOS_FOLDED)
        RD_fn_contents.push(addClauseSuccessCheck(RDOptions));
    else {
        if (RD_fn_contents[RD_fn_contents.length - 1]?.type !== "return")
            RD_fn_contents.push(<SKExpression>sk`return:-1`);
    }
}
