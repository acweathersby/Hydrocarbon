
/* 
 * Copyright (C) 2021 Anthony Weathersby - The Hydrocarbon Parser Compiler
 * see /source/typescript/hydrocarbon.ts for full copyright and warranty 
 * disclaimer notice.
 */
/**
 * Base id token integer identifiers 
*/
export const enum TokenTypes {
    UNDEFINED,
    END_OF_FILE,
    SYMBOL,
    IDENTIFIER,
    UNICODE_IDENTIFIER,
    NUMBER,
    NEW_LINE,
    SPACE,
    IDENTIFIERS,
    NUMBERS,
    CUSTOM_START_POINT,
    RECOVERY = 0,
}

