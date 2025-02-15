import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const rightArrowRightArrowEqualAgent: AgentFunction<
  object,
  unknown,
  Readonly<{ left: unknown; right: unknown }>
> = async ({ namedInputs: _ }) => Promise.resolve(Error("Operator '>>=' is not implemented yet"));

export const rightArrowRightArrowEqualAgentInfo: AgentFunctionInfo = {
  name: 'rightArrowRightArrowEqualAgent',
  agent: rightArrowRightArrowEqualAgent,
  mock: rightArrowRightArrowEqualAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
