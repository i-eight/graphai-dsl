import { AgentFunction, AgentFunctionContext, AgentFunctionInfo } from 'graphai';

type Response = Readonly<{
  stringify: Stringify;
  prettyStringify: PrettyStringify;
  parse: Parse;
}>;

type AFC<Args> = AgentFunctionContext<object, Args>;
type AFR<Return> = Promise<Return>;

//----------------------------------------------------------------------
type StringifyArg = AFC<unknown>;
type StringifyReturn = AFR<string>;
type Stringify = (_: StringifyArg) => StringifyReturn;

const stringify = async ({ namedInputs: _ }: StringifyArg): StringifyReturn => JSON.stringify(_);

//----------------------------------------------------------------------
type PrettyStringifyArg = AFC<unknown>;
type PrettyStringifyReturn = AFR<string>;
type PrettyStringify = (_: PrettyStringifyArg) => PrettyStringifyReturn;

const prettyStringify = async ({ namedInputs: _ }: PrettyStringifyArg): PrettyStringifyReturn =>
  JSON.stringify(_, null, 2);

//----------------------------------------------------------------------
type ParseArg = AFC<string>;
type ParseReturn = AFR<unknown>;
type Parse = (_: ParseArg) => ParseReturn;

const parse = async ({ namedInputs: _ }: ParseArg): ParseReturn => JSON.parse(_);

//----------------------------------------------------------------------
const JsonAgent: AgentFunction<object, Response> = async () => ({
  stringify,
  prettyStringify,
  parse,
});

export const JsonAgentInfo: AgentFunctionInfo = {
  name: 'JsonAgent',
  agent: JsonAgent,
  mock: JsonAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
