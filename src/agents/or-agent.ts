import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const orAgent: AgentFunction<
  object,
  boolean,
  Readonly<{ left: boolean; right: boolean }>
> = async ({ namedInputs: { left, right } }) => left || right;

export const orAgentInfo: AgentFunctionInfo = {
  name: 'orAgent',
  agent: orAgent,
  mock: orAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
