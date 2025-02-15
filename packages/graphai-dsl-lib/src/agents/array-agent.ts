import { readonlyArray, task } from 'fp-ts';
import { apply, pipe } from 'fp-ts/lib/function';
import { AgentFunction, AgentFunctionInfo } from 'graphai';
import { unit } from '../lib/unit';

type Response = Readonly<{
  size: Size;
  map: Map;
  filter: Filter;
  zip: Zip;
}>;

type Size = AgentFunction<object, number, ReadonlyArray<unknown>>;

type MapSelf = AgentFunction<object, ReadonlyArray<unknown>, ReadonlyArray<unknown>>;
type MapCallback = AgentFunction<object, unknown, unknown>;
type Map = AgentFunction<object, MapSelf, MapCallback>;

type FilterSelf = AgentFunction<object, ReadonlyArray<unknown>, ReadonlyArray<unknown>>;
type FilterCallback = AgentFunction<object, boolean, unknown>;
type Filter = AgentFunction<object, FilterSelf, FilterCallback>;

type ZipRight = AgentFunction<object, ReadonlyArray<unknown>, ReadonlyArray<unknown>>;
type Zip = AgentFunction<object, ZipRight, ReadonlyArray<unknown>>;

const arrayAgent: AgentFunction<object, Response> = async () => ({
  size: async ({ namedInputs: xs }) => xs.length,
  map:
    async ({ namedInputs: f }) =>
    ({ namedInputs: self, params, filterParams, debugInfo }) =>
      pipe(
        self,
        readonlyArray.reduce(task.of<ReadonlyArray<unknown>>([]), (m, x) =>
          pipe(
            task.Do,
            task.bind('xs', () => m),
            task.bind('x_', () => () => f({ namedInputs: x, params, filterParams, debugInfo })),
            task.map(({ xs, x_ }) => [...xs, x_]),
          ),
        ),
        apply(unit),
      ),

  filter:
    async ({ namedInputs: f }) =>
    ({ namedInputs: self, params, filterParams, debugInfo }) =>
      pipe(
        self,
        readonlyArray.reduce(task.of<ReadonlyArray<unknown>>([]), (m, x) =>
          pipe(
            task.Do,
            task.bind('xs', () => m),
            task.bind('flag', () => () => f({ namedInputs: x, params, filterParams, debugInfo })),
            task.map(({ xs, flag }) => (flag ? [...xs, x] : xs)),
          ),
        ),
        apply(unit),
      ),

  zip:
    async ({ namedInputs: xs }) =>
    async ({ namedInputs: ys }) =>
      readonlyArray.zip(xs, ys),
});

export const arrayAgentInfo: AgentFunctionInfo = {
  name: 'arrayAgent',
  agent: arrayAgent,
  mock: arrayAgent,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
