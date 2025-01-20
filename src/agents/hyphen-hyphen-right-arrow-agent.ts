import { AgentFunctionInfo } from 'graphai';
import { connectAgentInfo } from './connectAgent';

export const hyphenHyphenRightArrowAgentInfo: AgentFunctionInfo = {
  name: 'hyphenHyphenRightArrowAgent',
  agent: connectAgentInfo.agent,
  mock: connectAgentInfo.agent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
