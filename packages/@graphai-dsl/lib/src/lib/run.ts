import {
  AgentFunctionInfoDictionary,
  DefaultResultData,
  GraphData,
  ResultDataDictionary,
} from 'graphai/lib/type';
import * as compiler from './compiler';
import { GraphAI } from 'graphai/lib/graphai';
import { pipe } from 'fp-ts/lib/function';
import { either, taskEither } from 'fp-ts';
import * as error from './error';
import { TaskEither } from 'fp-ts/lib/TaskEither';
import { Either } from 'fp-ts/lib/Either';

export const runFromJson = (
  json: compiler.Json,
  agents: AgentFunctionInfoDictionary,
): TaskEither<unknown, ResultDataDictionary<DefaultResultData>> =>
  taskEither.fromTask(() => new GraphAI(json as GraphData, agents).run());

export const compileFromFile = (
  file: string,
  agents: AgentFunctionInfoDictionary,
): Either<error.FormattedErrors, compiler.Json> =>
  pipe(
    compiler.compileFromFile(file, agents),
    either.mapLeft(e => error.toFormattedError(e)),
  );
