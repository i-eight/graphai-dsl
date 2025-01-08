import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const ltAgent: AgentFunction<
  object,
  boolean,
  Readonly<{ left: boolean; right: boolean }>
> = async ({ namedInputs: { left, right } }) => left < right;

export const ltAgentInfo: AgentFunctionInfo = {
  name: 'ltAgent',
  agent: ltAgent,
  mock: ltAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
