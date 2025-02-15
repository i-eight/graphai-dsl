import { AgentFunction, AgentFunctionInfo } from 'graphai/lib/type';

const nativeImportAgent: AgentFunction<object, object, Readonly<{ path: string }>> = async ({
  namedInputs: { path },
}) => import(path);

export const nativeImportAgentInfo: AgentFunctionInfo = {
  name: 'nativeImportAgent',
  agent: nativeImportAgent,
  mock: nativeImportAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
