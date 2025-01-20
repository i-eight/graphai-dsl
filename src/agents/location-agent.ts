import { AgentFunction, AgentFunctionInfo } from 'graphai';
import geoip from 'geoip-lite';
import fetch from 'node-fetch';
import { option, task } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';

export type LocationFromIp = Readonly<{
  longitude: number;
  latitude: number;
  country: string;
  region: string;
  city: string;
  timezone: string;
}>;

const getLocationFromIpAgent: AgentFunction<object, LocationFromIp> = () =>
  pipe(
    () => fetch('https://ifconfig.me/ip'),
    task.flatMap(res => () => res.text()),
    task.flatMap(ip =>
      pipe(
        option.fromNullable(geoip.lookup(ip)),
        option.match(
          () => () => Promise.reject<geoip.Lookup>(new Error('No location found')),
          _ => task.of(_),
        ),
      ),
    ),
    task.map(
      _ =>
        ({
          ..._,
          latitude: _.ll[0],
          longitude: _.ll[1],
        }) satisfies LocationFromIp,
    ),
    run => run(),
  );

export const getLocationFromIpAgentInfo: AgentFunctionInfo = {
  name: 'getLocationFromIpAgent',
  agent: getLocationFromIpAgent,
  mock: getLocationFromIpAgent,

  description: 'Get location from ip address',

  inputs: {
    type: 'object',
    properties: {},
    required: [],
  },

  output: {
    type: 'object',
    properties: {
      longitude: 'number',
      latitude: 'number',
      country: 'string',
      region: 'string',
      city: 'string',
      timezone: 'string',
    },
  },

  samples: [],
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
