import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const neqAgent: AgentFunction<
  object,
  boolean,
  Readonly<{ left: boolean; right: boolean }>
> = async ({ namedInputs: { left, right } }) => left !== right;

export const neqAgentInfo: AgentFunctionInfo = {
  name: 'neqAgent',
  agent: neqAgent,
  mock: neqAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
