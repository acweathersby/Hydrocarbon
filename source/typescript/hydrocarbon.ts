
import { createGrammar } from "./grammar/compile_grammar.js";


//Hybrid
import {
    buildParserMemoryBuffer
} from "./runtime/parser_memory.js";

//Runtime - Deprecate
import { LexerError } from "./lr(deprecate)/runtime/lexer_error.js";
import { lrParse } from "./lr(deprecate)/runtime/lr_parser.js";

//Diagnostics
import { ParserEnvironment } from "./types/parser_environment.js";
import { ErrorHandler, ParserData } from "./lr(deprecate)/runtime/parser_data.js";



export {
    ErrorHandler,
    ParserData,
    LexerError,
    ParserEnvironment,
    createGrammar as compileGrammars,
    buildParserMemoryBuffer,
    lrParse
};
