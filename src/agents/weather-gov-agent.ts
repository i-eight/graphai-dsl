import { task } from 'fp-ts';
import { apply, pipe } from 'fp-ts/lib/function';
import { AgentFunction, AgentFunctionInfo } from 'graphai';
import fetch from 'node-fetch';
import { unit } from '../lib/unit';

export type Location = Readonly<{
  longitude: number;
  latitude: number;
}>;

export type PointsResponse = Readonly<{
  properties: {
    forecast: string;
    forecastHourly: string;
    forecastGridData: string;
    observationStations: string;
  };
}>;

export type ForecastResponse = Readonly<{
  properties: {
    periods: ReadonlyArray<{
      name: string;
      temperature: number;
      temperatureUnit: string;
      shortForecast: string;
    }>;
  };
}>;

export const getWeatherGovAgent: AgentFunction<
  object,
  ForecastResponse['properties'],
  Location
> = async ({ namedInputs }) =>
  pipe(
    () =>
      fetch(`https://api.weather.gov/points/${namedInputs.latitude},${namedInputs.longitude}`, {
        headers: {
          'User-Agent': 'GraphAI/0.6',
        },
      }),
    task.flatMap(_ => () => _.json()),
    task.map(_ => _ as PointsResponse),
    task.flatMap(_ => () => fetch(_.properties.forecast)),
    task.flatMap(_ => () => _.json()),
    task.map(_ => _ as ForecastResponse),
    task.map(_ => _.properties),
    apply(unit),
  );

export const getWeatherGovAgentInfo: AgentFunctionInfo = {
  name: 'getWeatherGovAgent',
  agent: getWeatherGovAgent,
  mock: getWeatherGovAgent,

  description: 'Get weather forecast from location',

  inputs: {
    type: 'object',
    properties: {
      longitude: 'number',
      latitude: 'number',
    },
    required: ['longitude', 'latitude'],
  },

  output: {
    type: 'object',
    properties: {
      periods: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: 'string',
            temperature: 'number',
            temperatureUnit: 'string',
            shortForecast: 'string',
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
