import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const barRightArrowAgent: AgentFunction<
  object,
  unknown,
  Readonly<{ left: unknown; right: (_: unknown) => Promise<unknown> }>
> = async ({ namedInputs: { left, right } }) => right({ namedInputs: left });

export const barRightArrowAgentInfo: AgentFunctionInfo = {
  name: 'barRightArrowAgent',
  agent: barRightArrowAgent,
  mock: barRightArrowAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
