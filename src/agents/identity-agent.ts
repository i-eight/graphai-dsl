import { AgentFunction, AgentFunctionInfo } from 'graphai';

const identityAgent: AgentFunction<object, unknown> = async ({ namedInputs }) => namedInputs;

export const identityAgentInfo: AgentFunctionInfo = {
  name: 'identityAgent',
  agent: identityAgent,
  mock: identityAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
