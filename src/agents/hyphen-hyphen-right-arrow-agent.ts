import { AgentFunction, AgentFunctionInfo } from 'graphai';
import { connectAgentInfo } from './connect-agent';

type Request = Readonly<{
  left: unknown;
  right: string;
}>;

const hyphenHyphenRightArrowAgent: AgentFunction<object, unknown, Request> = async args =>
  connectAgentInfo.agent({
    ...args,
    namedInputs: {
      from: args.namedInputs.left,
      to: args.namedInputs.right,
    },
  });

export const hyphenHyphenRightArrowAgentInfo: AgentFunctionInfo = {
  name: 'hyphenHyphenRightArrowAgent',
  agent: hyphenHyphenRightArrowAgent,
  mock: hyphenHyphenRightArrowAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
