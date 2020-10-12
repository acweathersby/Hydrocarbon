import { Grammar, Symbol } from "../types/grammar.js";
import { Item } from "../util/common.js";
export function getClosureTerminalSymbols(closure: Item[], grammar: Grammar): Symbol[] {
    const syms = [];


    for (const item of closure) {
        if (item.atEND)
            continue;
        const sym = item.sym(grammar);
        if (sym.type !== "production")
            syms.push(sym);
    }

    return syms.setFilter(s => s.val);
}
