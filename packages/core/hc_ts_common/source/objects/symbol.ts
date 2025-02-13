/* 
 * Copyright (C) 2021 Anthony Weathersby - The Hydrocarbon Parser Compiler
 * see /source/typescript/hydrocarbon.ts for full copyright and warranty 
 * disclaimer notice.
 */
import { Lexer } from "@candlelib/wind";
import {
    AmbiguousSymbol, DefinedCharacterSymbol,
    DefinedIdentifierSymbol,
    DefinedNumericSymbol,
    DefinedSymbol,
    EmptySymbol,
    DEFAULTSymbol,
    GeneratedIdentifier,
    GeneratedNewLine,
    GeneratedNumber,
    GeneratedSpace,
    GeneratedSymbol,
    GrammarObject,
    HCG3Symbol, LookBehindSymbol,
    ProductionSymbol,
    ProductionTokenSymbol, RecoverySymbol, SymbolType, TokenSymbol,
    VirtualTokenSymbol
} from "../types/index.js";
import { Item } from "../utilities/item.js";


export function getTrueSymbolValue(sym: TokenSymbol, grammar: GrammarObject): TokenSymbol[] {
    return [<TokenSymbol>sym];
}
export function characterToUTF8(char: string) {

    const code_point = char.codePointAt(0) || 0;

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

export function convert_symbol_to_string(sym: HCG3Symbol): string {
    if (!sym || !sym.type)
        return "<unknown>";
    switch (sym.type) {
        case SymbolType.GENERATED:
            return `g:${sym.val}`;
        case SymbolType.LITERAL:
            return `\\${sym.val}` + (sym.IS_NON_CAPTURE ? "-ns" : "");
        case SymbolType.EXCLUSIVE_LITERAL:
            return `t:${sym.val}` + (sym.IS_NON_CAPTURE ? "-ns" : "");
        case SymbolType.EMPTY:
            return `ɛ`;
        case SymbolType.DEFAULT:
            return `DEFAULT`;
        case SymbolType.PRODUCTION_TOKEN_SYMBOL:
            return `tk:${sym.name}`;
        case "look-behind":
            return `lb[${convert_symbol_to_string(sym.phased)}]`;
        default:
            return sym.val + (sym.IS_NON_CAPTURE ? "-ns" : "");
    }
}

export function convert_symbol_to_friendly_name(sym: HCG3Symbol): string {
    if (!sym || !sym.type)
        return "<unknown>";
    switch (sym.type) {
        case SymbolType.GENERATED:
            switch (sym.val) {
                case "id": return "Letter";
                case "ids": return "Identifier";
                case "num": return "Digit";
                case "nums": return "Number";
                case "sym": return "Symbol";
                case "syms": return "Symbols";
                case "nl": return "New Line";
                case "sp": return "Space";
                case "DEFAULT": return "<EOF>";
                default: return "";
            }
        case SymbolType.LITERAL:
            return `${sym.val}`;
        case SymbolType.EXCLUSIVE_LITERAL:
            return `${sym.val}`;
        case SymbolType.EMPTY:
            return `ɛ`;
        case SymbolType.DEFAULT:
            return `<EOF>`;
        case SymbolType.PRODUCTION_TOKEN_SYMBOL:
            return `tk:${sym.name}`;
        case "look-behind":
            return `lb[${convert_symbol_to_friendly_name(sym.phased)}]`;
        default:
            return `${sym.val}`;
    }
}

export function getSymbolName(sym: HCG3Symbol) {

    if (!sym) return "";

    return sym.type + " [" + (sym.name ? `"${sym.name}"` : (<any>sym).val) + "]";
}
export function Sym_Is_Recovery(sym: HCG3Symbol): sym is RecoverySymbol {
    return sym.id == 0;
}
export function getUniqueSymbolName(sym: HCG3Symbol, _a?: any, _b?: any) {
    if (!sym)
        return "not-a-symbol";
    return getSymbolName(sym);
}
export function Sym_Is_Not_Consumed(s: HCG3Symbol): boolean {
    return !!s.IS_NON_CAPTURE || Sym_Is_Look_Behind(s);
}

export function Sym_Is_Look_Behind(s: HCG3Symbol): s is LookBehindSymbol {
    return s.type == SymbolType.LOOK_BEHIND;
}
export function Sym_Is_DEFAULT(s: HCG3Symbol): s is DEFAULTSymbol {
    return s.type == SymbolType.DEFAULT || s.val == "DEFAULT";
}
export function Sym_Is_Empty(s: HCG3Symbol): s is EmptySymbol {
    return s.type == SymbolType.EMPTY;
}

export function Sym_Is_Consumed(s: HCG3Symbol): boolean {
    return !Sym_Is_Not_Consumed(s);
}

export function Sym_Is_Virtual_Token(s: HCG3Symbol): s is VirtualTokenSymbol {
    return s && s.type == SymbolType.VIRTUAL_TOKEN;
}

export function Sym_Is_Ambiguous(s: HCG3Symbol): s is AmbiguousSymbol {
    return s && s.type == SymbolType.AMBIGUOUS;
}

export function Sym_Is_A_Production(s: HCG3Symbol): s is ProductionSymbol {
    if (!s) return false;
    return s.type == SymbolType.PRODUCTION;
}

export function Sym_Is_A_Production_Token(s: HCG3Symbol): s is (ProductionTokenSymbol) {
    if (!s) return false;
    return (s.type == SymbolType.PRODUCTION_TOKEN_SYMBOL);
}

export function Sym_Is_A_Token(s: HCG3Symbol): s is TokenSymbol {
    return !Sym_Is_A_Production(s);
}

export function Sym_Is_An_Assert_Function(s: HCG3Symbol): s is any {
    return false;
}

export function Sym_Is_A_Generic_Type(s: HCG3Symbol): s is (
    GeneratedSymbol
    | GeneratedNewLine
    | GeneratedNumber
    | RecoverySymbol
    | GeneratedSpace
    | GeneratedIdentifier
    | DEFAULTSymbol
) {
    return (s.type == SymbolType.GENERATED || Sym_Is_DEFAULT(s));
}

/**
 * Any symbol that is not Generated, an AssertFunction, or a Production
 * @param s
 */
export function Sym_Is_Exclusive(s: HCG3Symbol): boolean {

    return s.type == SymbolType.EXCLUSIVE_LITERAL;
}

export function Sym_Is_Defined(s: HCG3Symbol): s is DefinedSymbol {
    return !Sym_Is_A_Production(s) && !Sym_Is_A_Generic_Type(s) && !Sym_Is_Look_Behind(s) && !Sym_Is_A_Production_Token(s);
}
/**
 * A SpecifiedSymbol that is not a SpecifiedIdentifierSymbol nor a SpecifiedNumericSymbol
 * @param s
 */
export function Sym_Is_Defined_Symbol(s: HCG3Symbol): s is DefinedCharacterSymbol {
    return Sym_Is_Defined(s) && !Defined_Sym_Is_An_Identifier(s) && !Sym_Is_Numeric(s);
}
export function Sym_Is_Defined_Identifier(s: HCG3Symbol): s is DefinedIdentifierSymbol {
    return Sym_Is_Defined(s) && Defined_Sym_Is_An_Identifier(s);
}
export function Sym_Is_Defined_Natural_Number(s: HCG3Symbol): s is DefinedNumericSymbol {
    return Sym_Is_Defined(s) && Sym_Is_Numeric(s);
}
export function Sym_Is_Numeric(sym: HCG3Symbol): sym is DefinedNumericSymbol {
    const lex = new Lexer(sym.val + "");
    return lex.ty == lex.types.num && lex.pk.END;
}
export function Sym_Is_Not_Numeric(sym: HCG3Symbol): boolean {
    return !Sym_Is_Numeric(sym);
}
/**
 * Any defined symbol whose character sequence begins with a character from
 * the Unicode *ID_Start* class.
 * 
 * see: https://unicode.org/reports/tr31/
 * @param sym 
 */
export function Defined_Sym_Is_An_Identifier(sym: HCG3Symbol): sym is DefinedIdentifierSymbol {
    const val = sym.val + "";
    const lex = new Lexer(val + "");
    return lex.ty == lex.types.id && lex.tl == val.length;
}

export function Sym_Is_Not_A_Defined_Identifier(sym: HCG3Symbol): boolean {
    return !Sym_Is_Defined_Identifier(sym);
}
export function Sym_Has_Just_One_Character(sym: HCG3Symbol) {

    if ((sym.val + "").length > 1)
        return false;

    const lex = new Lexer(sym.val + "");

    return !(lex.ty == lex.types.id || lex.ty == lex.types.num);
}
export function Sym_Has_Multiple_Characters(sym: HCG3Symbol): boolean {
    return !Sym_Has_Just_One_Character(sym);
}
export function Sym_Is_A_Generic_Newline(sym: HCG3Symbol): sym is GeneratedSymbol { return sym.val == "nl" && sym.type == SymbolType.GENERATED; }

export function Sym_Is_A_Generic_Identifier(sym: HCG3Symbol): sym is GeneratedSymbol { return sym.val == "id" && sym.type == SymbolType.GENERATED; }

export function Sym_Is_A_Generic_Symbol(sym: HCG3Symbol): sym is GeneratedSymbol { return sym.val == "sym" && sym.type == SymbolType.GENERATED; }

export function Sym_Is_A_Generic_Number(sym: HCG3Symbol): sym is GeneratedSymbol { return sym.val == "num" && sym.type == SymbolType.GENERATED; }

export function Sym_Is_A_Space_Generic(sym: HCG3Symbol): sym is GeneratedSymbol { return sym.val == "ws"; }

export function getFollowSymbolsFromItems(items: Item[], grammar: GrammarObject): TokenSymbol[] {
    return items.filter(i => i.atEND)
        .flatMap(i => [...grammar.item_map.get(i.id).follow.values()])
        .setFilter()
        .map(sym => <TokenSymbol>grammar.meta.all_symbols.get(sym));
}

export function getTokenSymbolsFromItems(items: Item[], grammar: GrammarObject): TokenSymbol[] {
    return items.filter(i => !i.atEND)
        .flatMap(i => getTrueSymbolValue(<TokenSymbol>i.sym(grammar), grammar))

        .setFilter(getUniqueSymbolName)
        .filter(sym => !Sym_Is_A_Production(sym));
}

export function getSkippableSymbolsFromItems(items: Item[], grammar: GrammarObject): TokenSymbol[] {
    return items.flatMap(i => [...grammar.item_map.get(i.id).skippable.values()])
        .map(sym => <TokenSymbol>grammar.meta.all_symbols.get(sym))

        .setFilter(getUniqueSymbolName);
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

export function getSymbolFromUniqueName(grammar: GrammarObject, name: string): HCG3Symbol {
    return grammar.meta.all_symbols.get(name);
}

export function getRootSym<T = HCG3Symbol>(sym: T, grammar: GrammarObject): T {
    if ((<HCG3Symbol><any>sym).type == SymbolType.DEFAULT)
        return sym;

    const name = getUniqueSymbolName(<HCG3Symbol><any>sym);

    const obj = Object.assign({}, <T><any>grammar.meta.all_symbols.get(name) || sym, sym);

    return obj;
}

export function Symbols_Occlude(target: HCG3Symbol, potentially_occludes: HCG3Symbol): boolean {

    if (Sym_Is_A_Production(target) || Sym_Is_A_Production(potentially_occludes)) return false;
    if (Symbols_Are_The_Same(target, potentially_occludes)) return false;
    if (target.val == potentially_occludes.val) return false;

    if (Sym_Is_A_Generic_Symbol(potentially_occludes) && Sym_Is_Defined_Symbol(target)) return true;
    if (Sym_Is_A_Generic_Identifier(potentially_occludes) && Sym_Is_Defined_Identifier(target)) return true;
    if (Sym_Is_A_Generic_Number(potentially_occludes) && Sym_Is_Defined_Natural_Number(target)) return true;

    return Defined_Symbols_Occlude(target, potentially_occludes);
}
/**
 * Returns true if `target` is occluded by `potentially_occludes`
 * @param target 
 * @param potentially_occludes 
 * @returns 
 */
export function Defined_Symbols_Occlude(target: HCG3Symbol, potentially_occludes: HCG3Symbol): boolean {

    if (!Sym_Is_Defined(target) || !Sym_Is_Defined(potentially_occludes)) return false;

    let
        short = target.val.toString(),
        long = potentially_occludes.val.toString();

    if (short.length > long.length) return false;

    for (let i = 0; i < short.length; i++)
        if (short[i] !== long[i]) return false;

    return true;
}

export function Symbols_Are_The_Same(a: HCG3Symbol, b: HCG3Symbol) {
    return getUniqueSymbolName(a) == getUniqueSymbolName(b);
}

export function getUnskippableSymbolsFromClosure(closure: Item[], grammar: GrammarObject): any {
    return [...new Set(closure.flatMap(i => grammar.item_map.get(i.id).reset_sym)).values()].map(sym => grammar.meta.all_symbols.get(sym));
}

export function getSymbolsFromClosure(closure: Item[], grammar: GrammarObject): HCG3Symbol[] {
    return [
        ...new Set(
            closure
                .filter(i => !i.atEND)
                .filter(i => !Sym_Is_A_Production(i.sym(grammar)))
                .flatMap(i => getTrueSymbolValue(<TokenSymbol>i.sym(grammar), grammar))
        ).values()
    ];
}

export function SymbolsCollide(symA: HCG3Symbol, symB: HCG3Symbol, grammar: GrammarObject): boolean {
    return grammar.collision_matrix[symA.id][symB.id];
};