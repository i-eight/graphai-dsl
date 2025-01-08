import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const andAgent: AgentFunction<
  object,
  boolean,
  Readonly<{ left: boolean; right: boolean }>
> = async ({ namedInputs: { left, right } }) => left && right;

export const andAgentInfo: AgentFunctionInfo = {
  name: 'andAgent',
  agent: andAgent,
  mock: andAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
