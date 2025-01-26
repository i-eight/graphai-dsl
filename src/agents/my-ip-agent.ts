import { task } from 'fp-ts';
import { apply, pipe } from 'fp-ts/lib/function';
import { AgentFunction, AgentFunctionInfo } from 'graphai';
import { unit } from '../lib/unit';

type Response = Readonly<{
  ip: string;
}>;

const getMyIpAgent: AgentFunction<object, Response> = async () =>
  pipe(
    () => fetch('https://ifconfig.me/ip'),
    task.flatMap(res => () => res.text()),
    task.map(ip => ({ ip }) as Response),
    apply(unit),
  );

export const getMyIpAgentInfo: AgentFunctionInfo = {
  name: 'getMyIpAgent',
  agent: getMyIpAgent,
  mock: getMyIpAgent,

  description: 'Get location from ip address',

  inputs: {},

  output: {
    type: 'object',
    properties: {
      ip: 'string',
    },
  },

  samples: [],
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
