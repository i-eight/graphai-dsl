import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const eqAgent: AgentFunction<
  object,
  boolean,
  Readonly<{ left: boolean; right: boolean }>
> = async ({ namedInputs: { left, right } }) => left === right;

export const eqAgentInfo: AgentFunctionInfo = {
  name: 'eqAgent',
  agent: eqAgent,
  mock: eqAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
