/* 
 * Copyright (C) 2021 Anthony Weathersby - The Hydrocarbon Parser Compiler
 * see /source/typescript/hydrocarbon.ts for full copyright and warranty 
 * disclaimer notice.
 */
import { Lexer } from "@candlefw/wind";
import { Grammar } from "../types/grammar.js";
import {
    AssertionFunctionSymbol,
    DefinedCharacterSymbol,
    DefinedIdentifierSymbol,
    DefinedNumericSymbol,
    DefinedSymbol, EOFSymbol,
    GeneratedSymbol,
    ProductionSymbol,
    ProductionTokenSymbol,
    Symbol,
    TokenSymbol
} from "../types/symbol";
import { SymbolType } from "../types/symbol_type.js";
import { getTrueSymbolValue } from "./code_generating.js";
import { Item } from "./item.js";


export function characterToUTF8(char: string) {

    const code_point = char.codePointAt(0);

    if ((code_point & 0x7F) == code_point) {
        return `utf8_1(l,${code_point})`;
    } else if ((code_point & 0x7FF) == code_point) {
        return `utf8_2(l,${code_point})`;
    } else if ((code_point & 0xFFFF) == code_point) {
        return `utf8_3(l,${code_point})`;
    } else {
        return `utf8_4(l,${code_point})`;
    }
}
export function convertSymbolToString(sym: Symbol) {
    switch (sym.type) {
        case SymbolType.ESCAPED:
        case SymbolType.SYMBOL:
            return `${sym.val}`;
        case SymbolType.GENERATED:
            return `θ${sym.val}`;
        case SymbolType.LITERAL:
            return `τ${sym.val}`;
        case SymbolType.EMPTY:
            return `ɛ`;
        case SymbolType.END_OF_FILE:
            return `END_OF_FILE`;
        case SymbolType.PRODUCTION_TOKEN_SYMBOL:
            return `tk:${sym.name}`;
        default:
            return sym.val;
    }
}
export function getSymbolName(sym: Symbol) {
    if (!sym)
        return "";

    return "[" + sym.val + "]" + sym.type;
}
export function getUniqueSymbolName(sym: Symbol) {
    if (!sym)
        return "not-a-symbol";
    return getSymbolName(sym)
        + (sym.DOES_SHIFT ? "----" : "")
        + (sym.IS_NON_CAPTURE ? "-->" : "");
}

export function Sym_Is_Compound(s: Symbol): s is DefinedCharacterSymbol {
    return Sym_Is_Defined_Symbols(s) && s.val.length > 1;
}
export function Sym_Is_Not_Consumed(s: Symbol): boolean {
    return !!s.IS_NON_CAPTURE;
}
export function Sym_Is_EOF(s: Symbol): s is EOFSymbol {
    return s.type == SymbolType.END_OF_FILE || s.val == "END_OF_FILE";
}
export function Sym_Is_Consumed(s: Symbol): boolean {
    return !Sym_Is_Not_Consumed(s);
}
export function Sym_Is_A_Production(s: Symbol): s is ProductionSymbol {
    if (!s) return false;
    return s.type == SymbolType.PRODUCTION || Sym_Is_A_Production_Token(s);
}

export function Sym_Is_A_Production_Token(s: Symbol): s is (ProductionTokenSymbol) {
    if (!s) return false;
    return (s.type == SymbolType.PRODUCTION_TOKEN_SYMBOL);
}

export function Sym_Is_A_Terminal(s: Symbol): s is TokenSymbol {
    return false == Sym_Is_A_Production(s) || Sym_Is_A_Production_Token(s);
}

export function Sym_Is_A_Token(s: Symbol): s is TokenSymbol {
    return Sym_Is_A_Terminal(s);
}


export function Sym_Is_An_Assert_Function(s: Symbol): s is AssertionFunctionSymbol {
    return s.type == SymbolType.PRODUCTION_ASSERTION_FUNCTION;
}

export function Sym_Is_A_Generic_Type(s: Symbol): s is (GeneratedSymbol | EOFSymbol) {
    return (s.type == SymbolType.GENERATED || Sym_Is_EOF(s));
}
/**
 * Any symbol that is not Generated, an AssertFunction, or a Production
 * @param s
 */

export function Sym_Is_Defined(s: Symbol): s is DefinedSymbol {
    return !Sym_Is_A_Production(s) && !Sym_Is_A_Generic_Type(s);
}
/**
 * A SpecifiedSymbol that is not a SpecifiedIdentifierSymbol nor a SpecifiedNumericSymbol
 * @param s
 */
export function Sym_Is_Defined_Symbols(s: Symbol): s is DefinedCharacterSymbol {
    return Sym_Is_Defined(s) && !Defined_Sym_Is_An_Identifier(s) && !Sym_Is_Numeric(s);
}
export function Sym_Is_Defined_Identifier(s: Symbol): s is DefinedIdentifierSymbol {
    return Sym_Is_Defined(s) && Defined_Sym_Is_An_Identifier(s);
}
export function Sym_Is_Defined_Natural_Number(s: Symbol): s is DefinedNumericSymbol {
    return Sym_Is_Defined(s) && Sym_Is_Numeric(s);
}
export function Sym_Is_Numeric(sym: Symbol): sym is DefinedNumericSymbol {
    const lex = new Lexer(sym.val + "");
    return lex.ty == lex.types.num && lex.pk.END;
}
export function Sym_Is_Not_Numeric(sym: Symbol): boolean {
    return !Sym_Is_Numeric(sym);
}
/**
 * Any defined symbol whose character sequence begins with a character from
 * the Unicode *ID_Start* class.
 * 
 * see: https://unicode.org/reports/tr31/
 * @param sym 
 */
export function Defined_Sym_Is_An_Identifier(sym: Symbol): sym is DefinedIdentifierSymbol {
    const lex = new Lexer(sym.val + "");
    return lex.ty == lex.types.id;
}
export function Sym_Is_Not_A_Defined_Identifier(sym: Symbol): boolean {
    return !Sym_Is_Defined_Identifier(sym);
}
export function Sym_Has_Just_One_Character(sym: Symbol) {

    if ((sym.val + "").length > 1)
        return false;

    const lex = new Lexer(sym.val + "");

    return !(lex.ty == lex.types.id || lex.ty == lex.types.num);
}
export function Sym_Has_Multiple_Characters(sym: Symbol): boolean {
    return !Sym_Has_Just_One_Character(sym);
}
export function Sym_Is_A_Generic_Newline(sym: Symbol): sym is GeneratedSymbol { return sym.val == "nl" && sym.type == SymbolType.GENERATED; }
export function Sym_Is_A_Generic_Identifier(sym: Symbol): sym is GeneratedSymbol { return sym.val == "id" && sym.type == SymbolType.GENERATED; }
export function Sym_Is_A_Generic_Symbol(sym: Symbol): sym is GeneratedSymbol { return sym.val == "sym" && sym.type == SymbolType.GENERATED; }
export function Sym_Is_A_Generic_Number(sym: Symbol): sym is GeneratedSymbol { return sym.val == "num" && sym.type == SymbolType.GENERATED; }
export function Sym_Is_A_Space_Generic(sym: Symbol): sym is GeneratedSymbol { return sym.val == "ws"; }

export function getFollowSymbolsFromItems(items: Item[], grammar: Grammar): TokenSymbol[] {
    return items.filter(i => i.atEND)
        .flatMap(i => [...grammar.item_map.get(i.id).follow.values()])
        .setFilter()
        .map(sym => <TokenSymbol>grammar.meta.all_symbols.get(sym));
}

export function getTokenSymbolsFromItems(items: Item[], grammar: Grammar): TokenSymbol[] {
    return items.filter(i => !i.atEND)
        .flatMap(i => getTrueSymbolValue(<TokenSymbol>i.sym(grammar), grammar))
        .setFilter(getUniqueSymbolName)
        .filter(sym => !Sym_Is_A_Production(sym) || Sym_Is_A_Production_Token(sym));
}

export function getSkippableSymbolsFromItems(items: Item[], grammar: Grammar): TokenSymbol[] {

    return items.flatMap(i => [...grammar.item_map.get(i.id).skippable.values()])
        .group()
        .filter(grp => grp.length == items.length)
        .map(grp => grp[0])
        .map(sym => <TokenSymbol>grammar.meta.all_symbols.get(sym))
        .flatMap(sym => <TokenSymbol[]>getTrueSymbolValue(sym, grammar));
}

/**
 * ret = setA \ setB
 * @param setA 
 * @param setB 
 */
export function getComplementOfSymbolSets(setA: TokenSymbol[], setB: TokenSymbol[]): TokenSymbol[] {
    return setA.filter(a => {
        const unique_name = getUniqueSymbolName(a);
        return !setB.some(b => getUniqueSymbolName(b) == unique_name);
    });
}
;

export function getSymbolFromUniqueName(grammar: Grammar, name: string): Symbol {
    return grammar.meta.all_symbols.get(name);
}
export function getRootSym<T = Symbol>(sym: T, grammar: Grammar): T {
    if ((<Symbol><any>sym).type == SymbolType.END_OF_FILE)
        return sym;

    const name = getUniqueSymbolName(<Symbol><any>sym);

    return <T><any>grammar.meta.all_symbols.get(name) || sym;
}

export function Symbols_Occlude(target: Symbol, potentially_occludes: Symbol): boolean {

    if (Sym_Is_A_Production(target) || Sym_Is_A_Production(potentially_occludes)) return false;
    if (Symbols_Are_The_Same(target, potentially_occludes)) return false;
    if (target.val == potentially_occludes.val) return false;

    if (Sym_Is_A_Generic_Symbol(potentially_occludes) && Sym_Is_Defined_Symbols(target)) return true;
    if (Sym_Is_A_Generic_Identifier(potentially_occludes) && Sym_Is_Defined_Identifier(target)) return true;
    if (Sym_Is_A_Generic_Number(potentially_occludes) && Sym_Is_Defined_Natural_Number(target)) return true;

    return Defined_Symbols_Occlude(target, potentially_occludes);
}

export function Defined_Symbols_Occlude(target: Symbol, potentially_occludes: Symbol): boolean {

    if(!Sym_Is_Defined(target) || !Sym_Is_Defined(potentially_occludes)) return false
    
    let
        short = target.val.toString(),
        long = potentially_occludes.val.toString();

    if (short.length > long.length) return false;

    for (let i = 0; i < short.length; i++)
        if (short[i] !== long[i]) return false;

    return true;
}
export function Symbols_Are_The_Same(a: Symbol, b: Symbol) {
    return getUniqueSymbolName(a) == getUniqueSymbolName(b);
}

export function getUnskippableSymbolsFromClosure(closure: Item[], grammar: Grammar): any {
    return [...new Set(closure.flatMap(i => grammar.item_map.get(i.id).reset_sym)).values()].map(sym => grammar.meta.all_symbols.get(sym));
}

export function getSymbolsFromClosure(closure: Item[], grammar: Grammar): Symbol[] {
    return [
        ...new Set(
            closure
                .filter(i => !i.atEND)
                .filter(i => !Sym_Is_A_Production(i.sym(grammar)) || Sym_Is_A_Production_Token(i.sym(grammar)))
                .flatMap(i => getTrueSymbolValue(<TokenSymbol>i.sym(grammar), grammar))
        ).values()
    ];
}
