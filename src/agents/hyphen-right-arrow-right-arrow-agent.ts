import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const hyphenRightArrowRightArrowAgent: AgentFunction<
  object,
  unknown,
  Readonly<{ left: unknown; right: unknown }>
> = async ({ namedInputs: _ }) => Promise.resolve(Error("Operator '->>' is not implemented yet"));

export const hyphenRightArrowRightArrowAgentInfo: AgentFunctionInfo = {
  name: 'hyphenRightArrowRightArrowAgent',
  agent: hyphenRightArrowRightArrowAgent,
  mock: hyphenRightArrowRightArrowAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
