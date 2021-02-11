import { getGrammar } from "./tools.js";
import URL from "@candlefw/url";
import { constructHybridFunction } from "../build/library/compiler/function_constructor.js";
import { constructCompilerRunner } from "../build/library/compiler/helper.js";
import { AS } from "../build/library/utilities/skribble.js";

const uri = URL.resolveRelative("./source/grammars/misc/default-productions.hcg");
const grammar = await getGrammar(uri + "");

const prod = grammar[3];
const runner = constructCompilerRunner(true);
const { fn } = constructHybridFunction(prod, grammar, runner);
const code = Object.assign(new AS, fn).renderCode();
assert(8000, inspect, code == "null");