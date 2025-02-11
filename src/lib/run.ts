import {
  AgentFunctionInfoDictionary,
  DefaultResultData,
  GraphData,
  ResultDataDictionary,
} from 'graphai/lib/type';
import * as compiler from './compiler';
import { GraphAI } from 'graphai/lib/graphai';
import { pipe } from 'fp-ts/lib/function';
import { agents } from '../agents';
import { either, taskEither } from 'fp-ts';
import { Unit, unit } from './unit';
import * as error from './error';
import { TaskEither } from 'fp-ts/lib/TaskEither';
import { Either } from 'fp-ts/lib/Either';
import { readFile } from './file';

export const runFromJson = (
  json: compiler.Json,
  agents: AgentFunctionInfoDictionary,
): TaskEither<unknown, ResultDataDictionary<DefaultResultData>> =>
  taskEither.fromTask(() => new GraphAI(json as GraphData, agents).run());

export const handleError = (e: unknown): Either<Unit, Unit> =>
  pipe(
    error.isParserError(e) || error.isCompileError(e)
      ? console.error(error.prettyString(e))
      : console.error(e),
    () => either.of(unit),
  );

export const compileFromFile = (file: string): Either<Unit, Unit> =>
  pipe(
    compiler.compileFromFile(file, agents),
    either.map(() => unit),
    either.orElse(handleError),
  );

export const runFromFile = (
  file: string,
  options: Readonly<{ json: boolean }> = {
    json: false,
  },
): TaskEither<Unit, Unit> =>
  pipe(
    options.json
      ? pipe(
          readFile(file),
          either.map(src => JSON.parse(src)),
        )
      : compiler.compileFromFile(file, agents),
    taskEither.fromEither,
    taskEither.flatMap(json => runFromJson(json, agents)),
    taskEither.map(() => unit),
    taskEither.orElse(e => taskEither.fromEither(handleError(e))),
  );
