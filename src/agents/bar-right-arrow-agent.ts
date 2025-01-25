import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';
import { applyAgentInfo } from './apply-agent';

const barRightArrowAgent: AgentFunction<
  object,
  unknown,
  Readonly<{ left: unknown; right: (_: unknown) => Promise<unknown> }>
> = async ({ params, namedInputs: { left, right }, forNestedGraph, filterParams, debugInfo }) =>
  applyAgentInfo.agent({
    params,
    namedInputs: { agent: right, args: left },
    forNestedGraph,
    filterParams,
    debugInfo,
  });

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
