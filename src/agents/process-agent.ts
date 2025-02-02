import { AgentFunction } from 'graphai';
import * as proc from 'process';

type Response = Readonly<NodeJS.ProcessEnv>;

const getProcessEnvAgent: AgentFunction<object, Response> = async () => proc.env;

export const getProcessEnvAgentInfo = {
  name: 'getProcessEnvAgent',
  agent: getProcessEnvAgent,
  mock: getProcessEnvAgent,

  description: 'Get process environment variables',

  inputs: {},

  output: {
    type: 'object',
    properties: {
      addtionalProperties: {
        type: 'string',
      },
    },
  },

  samples: [],
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
