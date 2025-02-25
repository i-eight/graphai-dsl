import { task } from 'fp-ts';
import { apply, pipe } from 'fp-ts/lib/function';
import { AgentFunction, AgentFunctionInfo } from 'graphai';
import { unit } from '../lib/unit';

type Request = Readonly<{
  latitude: number;
  longitude: number;
}>;

type Response = Readonly<{
  hourly_unit: Readonly<{
    time: string;
    temperature_2m: string;
    precipitation: string;
  }>;
  hourly: Readonly<{
    temperature_2m: ReadonlyArray<number>;
    precipitation: ReadonlyArray<number>;
  }>;
}>;

export const getWeatherFromOpenMeteoAgent: AgentFunction<object, Response, Request> = async ({
  namedInputs: { latitude, longitude },
}) =>
  pipe(
    () =>
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation&timezone=Asia/Tokyo`,
      ),
    task.flatMap(_ => () => _.json()),
    task.map(_ => _ as Response),
    apply(unit),
  );

export const getWeatherFromOpenMeteoAgentInfo: AgentFunctionInfo = {
  name: 'getWeatherFromOpenMeteoAgent',
  agent: getWeatherFromOpenMeteoAgent,
  mock: getWeatherFromOpenMeteoAgent,

  description: 'Get weather forecast from location',

  inputs: {
    type: 'object',
    properties: {
      longitude: { type: 'number' },
      latitude: { type: 'number' },
    },
    required: ['longitude', 'latitude'],
  },

  output: {
    type: 'object',
    properties: {
      hourly_unit: {
        type: 'object',
        properties: {
          time: { type: 'string' },
          temperature_2m: { type: 'string' },
          precipitation: { type: 'string' },
        },
      },
      hourly: {
        type: 'object',
        properties: {
          temperature_2m: {
            type: 'array',
            items: { type: 'number' },
          },
          precipitation: {
            type: 'array',
            items: { type: 'number' },
          },
        },
      },
    },
  },

  samples: [],
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
