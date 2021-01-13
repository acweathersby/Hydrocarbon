import { Symbol } from "../../types/Symbol";
import { Item } from "../../util/item";
import { SC } from "../utilities/skribble.js";

/**
 * Attribute that indicates the type of tree that
 * this node is the root of
 */
export const enum TRANSITION_TYPE {
    /**
     * Do not do anything with the token(s) before entering the next state(s)
     */
    IGNORE,
    /**
     * Indicates the token(s) of this state need to 
     * be consumed before progressing to the next state(s). 
     */
    CONSUME,
    /**
     * Indicates that the token(s) at this state only need to be 
     * asserted before progressing to the next state(s)
     */
    ASSERT,


    /**
     * Like ASSERT, except state is generated from a completed item.
     */
    ASSERT_END,
    /**
     * Like ASSERT, except state will call a production function.
     */
    ASSERT_PRODUCTION_SYMBOLS,
    /**
     * Like CHECK except the assertion should be made on the peeking lexer instead of
     * the main lexer.
     */
    PEEK,

    /**
     * Like ASSERT_PRODUCTION_SYMBOLS, except the assertion should be made on the peeking lexer instead of
     * the main lexer.
     */
    PEEK_PRODUCTION_SYMBOLS
};

/**
 * A parse state that has been transitioned to from either the start 
 * of the production function or from a proceeding state.
 */
export interface RecognizerState {
    /**
     * Code that should be added to the proceeding state's execution scope. May 
     * need to be gated by this state's symbol
     */
    code: SC;

    /**
     * MD5 hash string of code
     */
    hash: string;

    /**
     * The Terminal or Non-Terminal Symbol that leads to the transition to this state.
     */
    symbol: Symbol;

    /**
     * The depth of the peeking state relative to the initiation of the peek.
     */
    peek_level: number;

    /**
     * The depth of the state relative to the start of the production function.
     */
    offset: number;

    /**
     * Indicates the state is a will complete a production.
     */
    completing: boolean;

    /**
     * Active items at this state.
     */
    items: Item[];

    transition_type: TRANSITION_TYPE;

    /**
     * Current closure at this state. 
     */
    closure?: Item[];

    /**
     * The containing code does not require a boolean check
     */
    CAN_SKIP_BOOL_CHECK?: boolean;

    /**
     * production_ids that can be generated from this sequence
     */
    prods?: number[];
}