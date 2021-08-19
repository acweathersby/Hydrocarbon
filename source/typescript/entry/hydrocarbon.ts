/**
 * Copyright (C) 2021 Anthony Weathersby - The Hydrocarbon Parser Compiler
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * Contact: acweathersby.codes@gmail.com
 */

import "../utilities/array_globals.js";

//Runtime - Hybrid
import { initializeUTFLookupTable } from "../runtime/parser_memory_new.js";
import { loadWASM, buildParserMemoryBuffer } from "../runtime/parser_memory_old.js";
import { initializeUTFLookupTableNewPlus } from "../runtime/parser_memory_new.js";
import { ParserFactory } from "../runtime/parser_loader.js";
import { ParserFactory as ParserFactoryNew } from "../runtime/parser_loader_alpha.js";
import { ParserFactory as ParserFactoryBeta } from "../runtime/parser_loader_beta.js";
import { ParserFactory as ParserFactoryNext } from "../runtime/parser_loader_next.js";
import { Token } from "../runtime/token.js";
import { fillByteBufferWithUTF8FromString } from "../runtime/utf8.js";
export * as ParserCore from "../runtime/core_parser.js";

//Diagnostics
import { ParserEnvironment } from "../types/parser_environment.js";
import { compileGrammarFromString, compileGrammarFromURI } from "../grammar/compile.js";
import { HCGParser } from "../types/parser.js";

export {
    //Types
    HCGParser,
    ParserEnvironment,
    Token,

    //Code
    fillByteBufferWithUTF8FromString,
    loadWASM,
    ParserFactory,
    ParserFactoryNew,
    ParserFactoryNext,
    ParserFactoryBeta,
    buildParserMemoryBuffer,
    initializeUTFLookupTableNewPlus,


    initializeUTFLookupTable,
    compileGrammarFromString,
    compileGrammarFromURI
};

