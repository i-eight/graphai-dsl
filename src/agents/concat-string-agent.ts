import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const concatStringAgent: AgentFunction<
  object,
  string,
  Readonly<{ items: ReadonlyArray<unknown> }>
> = async ({ namedInputs: { items } }) =>
  items.reduce<string>((acc, item) => acc + String(item), '');

export const concatStringAgentInfo: AgentFunctionInfo = {
  name: 'concatStringAgent',
  agent: concatStringAgent,
  mock: concatStringAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
