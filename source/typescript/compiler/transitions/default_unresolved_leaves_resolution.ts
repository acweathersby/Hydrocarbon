import { RenderBodyOptions } from "../../types/render_body_options";
import { Symbol } from "../../types/symbol.js";
import { MultiItemReturnObject } from "../../types/transition_generating";
import { Leaf, TransitionNode, TRANSITION_TYPE } from "../../types/transition_node.js";
import { createBranchFunction, packGlobalFunction } from "../../utilities/code_generating.js";
import { rec_glob_lex_name, rec_state, rec_state_prod } from "../../utilities/global_names.js";
import { Item, ItemIndex } from "../../utilities/item.js";
import { renderItem } from "../../utilities/render_item.js";
import { SC } from "../../utilities/skribble.js";
import { getUniqueSymbolName, Sym_Is_A_Production } from "../../utilities/symbol.js";
import { createVirtualProductions, VirtualProductionLinks } from "../../utilities/virtual_productions.js";
import { compileProductionFunctions } from "../function_constructor.js";
import { addVirtualProductionLeafStatements } from "./add_leaf_statements.js";

export function default_resolveUnresolvedLeaves(node: TransitionNode, nodes: TransitionNode[], options: RenderBodyOptions): MultiItemReturnObject {

    const

        items = nodes.flatMap(s => s.items).setFilter(i => i.id),

        expected_symbols =
            nodes.flatMap(s => s.symbols).setFilter(getUniqueSymbolName)
                .concat(
                    items.flatMap(i => {
                        const sym = i.sym(options.grammar);
                        if (!Sym_Is_A_Production(sym))
                            return sym;
                        return [];
                    })
                ),

        anchor_state = SC.Variable("anchor_state:unsigned"),

        root: SC = (new SC).addStatement(
            nodes.flatMap(n => n.symbols).map(s => getUniqueSymbolName(s)).join(" ")
        ),

        IS_LEFT_RECURSIVE_WITH_FOREIGN_PRODUCTION_ITEMS = nodes.some(i => i.transition_type == TRANSITION_TYPE.IGNORE),

        out_prods: number[] = [],

        out_leaves: Leaf[] = [];

    let FALLBACK_REQUIRED = items.every(i => i.atEND);
    let v_depth = options.IS_VIRTUAL;
    if (!FALLBACK_REQUIRED)
        try {
            createVirtualProductionSequence(options, items, expected_symbols, root, out_leaves, out_prods);
        } catch (e) {
            //throw e;
            if (v_depth > 0) throw e;
            console.dir({ v_depth });
            root.statements.length = 0;
            //root.addStatement(e.stack);
            FALLBACK_REQUIRED = true;
        }



    if (FALLBACK_REQUIRED) {

        const USE_BACKTRACKING = false;
        const USE_FORKING = true;

        let leaf = root, I = 0;// prev_prods;

        const output_nodes = nodes.filter(i => i.transition_type !== TRANSITION_TYPE.IGNORE);

        if (USE_BACKTRACKING) {

            root.addStatement(
                SC.Declare(
                    SC.Assignment("mk:int", SC.Call("mark")),
                    SC.Assignment("anchor:Lexer", SC.Call(SC.Member(rec_glob_lex_name, "copy"))),
                    SC.Assignment(anchor_state, rec_state)
                ));

            for (const { code, items, prods, leaves } of output_nodes) {

                out_prods.push(...prods);

                out_leaves.push(...leaves);

                leaf.addStatement(SC.Comment(items));

                if (I++ == 0) {

                    leaf.addStatement(
                        SC.Comment(prods),
                        code
                    );

                } else {
                    leaf.addStatement(
                        SC.Assignment(rec_state, SC.Call(
                            "reset:bool",
                            "mk",
                            "anchor:Lexer",
                            rec_glob_lex_name,
                            anchor_state
                        )),
                        code,
                        SC.Empty()
                    );

                }
            }

            if (IS_LEFT_RECURSIVE_WITH_FOREIGN_PRODUCTION_ITEMS) {
                leaf.addStatement(
                    SC.Assignment(rec_state, SC.Call(
                        "reset:bool",
                        "mk",
                        "anchor:Lexer",
                        rec_glob_lex_name,
                        anchor_state
                    )),
                    SC.Empty()
                );
            }
        } else if (USE_FORKING) {

            for (const { code, items, prods, leaves } of output_nodes) {

                out_prods.push(...prods);
                out_leaves.push(...leaves);

                leaf.addStatement(items.map(i => i.renderUnformattedWithProduction(options.grammar)).join("\n"));

                const call_name = createBranchFunction(code, code, options.grammar, options.helper);

                if (I++ == output_nodes.length - 1) {

                    leaf.addStatement(
                        SC.Call("pushFN", "data", call_name),
                    );

                } else {
                    leaf.addStatement(SC.If().addStatement(
                        SC.Value("const fk = fork(data);"),
                        SC.Call("pushFN", "fk", call_name),
                    ));
                }
            }

            leaf.addStatement(SC.UnaryPre(SC.Return, SC.Value("0")));
        } else throw new Error(`Unable to resolve parsing ambiguities \n${items.map(i => i.renderUnformattedWithProduction(options.grammar)).join("\n")} `);
    }

    return { root, leaves: out_leaves, prods: out_prods.setFilter() };
}

export function createVirtualProductionSequence(
    options: RenderBodyOptions,
    items: Item[],
    expected_symbols: Symbol[] = [],
    root: SC,
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
) {
    const
        { grammar } = options,
        virtual_links: VirtualProductionLinks = createVirtualProductions(items, grammar);


    const { RDOptions, GOTO_Options, RD_fn_contents, GOTO_fn_contents }
        = compileProductionFunctions(
            options.grammar,
            options.helper,
            Array.from(virtual_links.values()).map(({ p }) => p),
            expected_symbols,
            (CLEAN ? 1 : options.IS_VIRTUAL + 1)
        );

    addVirtualProductionLeafStatements(
        RD_fn_contents,
        GOTO_fn_contents,
        RDOptions,
        GOTO_Options,
        virtual_links
    );

    let prod_ref = rec_state_prod;

    if (ALLOCATE_FUNCTION) {

        const vp_fn = SC.Function("", "l", "data", "state")
            .addStatement(
                SC.Declare(SC.Assignment(rec_state_prod, "0xFFFFFFFF")),
                RD_fn_contents,
                GOTO_Options.NO_GOTOS ? undefined : GOTO_fn_contents,
                SC.UnaryPre(SC.Return, SC.Value("prod"))
            );

        const call = packGlobalFunction("vp", "u32", items, vp_fn, options.helper);

        root.addStatement(SC.Declare(SC.Assignment("v_prod", SC.Call(call, "l", "data", "state"))));

        prod_ref = SC.Variable("v_prod:uint32");

    } else {

        if (options.scope == "RD")
            root.addStatement(SC.Declare(SC.Assignment(rec_state_prod, "0xFFFFFFFF")));

        root.addStatement(SC.Declare(SC.Assignment("preserved_state", "state")));

        root.addStatement(RD_fn_contents, GOTO_Options.NO_GOTOS ? undefined : GOTO_fn_contents);

    }

    let leaf = root;

    items.sort((a, b) => +a.atEND - +b.atEND);

    for (let i = 0; i < items.length; i++) {

        const item = Item.fromArray(items[i]);
        const v_prod = virtual_links.get(item.id);
        const ITEM_AT_END = item.atEND;

        item[ItemIndex.offset] = item[ItemIndex.length];

        const _if = SC.If(ITEM_AT_END ? SC.Empty() : SC.Binary(prod_ref, "==", v_prod.i));
        let _if_leaf = new SC;

        if (!ALLOCATE_FUNCTION) _if.addStatement(SC.Assignment("state", "preserved_state"));

        _if.addStatement(_if_leaf);

        const { prods, leaf_node } = renderItem(_if_leaf, item, options);

        _if_leaf = leaf_node;

        out_prods.push(...prods);

        leaf.addStatement(_if);
        leaf = _if;

        out_leaves.push({
            prods: prods,
            root: _if,
            leaf: _if_leaf,
            hash: "----------------",
            transition_type
        });
    }
}