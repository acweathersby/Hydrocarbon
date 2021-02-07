import { Helper } from "../compiler/helper.js";
import { Item } from "../utilities/item.js";
import { Grammar } from "./grammar.js";
import { Production } from "./production";
import { Leaf } from "./transition_node.js";

export interface RenderBodyOptions {

    scope: "RD" | "GOTO",

    /**
     * Source grammar for the language
     */
    grammar?: Grammar;

    /**
     * Active Compiler Runner
     */
    helper?: Helper;

    /**
     * Production currently being processed
     */
    productions?: Production[];

    /**
     * Ids of all productions
     */
    production_ids: number[],

    /**
     * List of all production ids whose production function is called
     */
    called_productions?: Set<number>;

    /**
     * List of all productions that are produced from leaf production nodes
     */
    leaf_productions: Set<number>;

    goto_items: Item[];

    /**
     * Items that shift on a production but are 
     * not part of the productions initial closure.
     */
    extended_goto_items: Item[];

    //cache: Map<string, { code: SC, prods: number[]; leaves: Leaf[], hash: string; }>;

    /**
     * Used to track active production shift production ids
     */
    active_keys: number[];

    /**
     * Information from all single item leaf nodes.
     */
    leaves: Leaf[];

    /**
     * Set to true if there are no production transitions
     */
    NO_GOTOS: boolean;
    /**
     * All items in the grammar that are `S => a . A` for some production `A`
     */
    global_production_items: Item[];

}
export const enum ReturnType {
    ACCEPT = 0,
    RETURN = 1,
    NONE = 2
}
