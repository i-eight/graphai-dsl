import { pipe } from 'fp-ts/lib/function';
import { either, taskEither } from 'fp-ts';
import { TaskEither } from 'fp-ts/lib/TaskEither';
import { Either } from 'fp-ts/lib/Either';
import {
  runFromJson,
  compileFromFile as compileFromFile_,
  error,
  unit,
  Unit,
  agents,
  readFile,
  compiler,
} from '@graphai-dsl/lib';

export const handleError = (e: unknown): Either<Unit, Unit> =>
  pipe(error.isFormatedErrors(e) ? console.error(error.prettyString(e)) : console.error(e), () =>
    either.of(unit),
  );

export const compileFromFile = (file: string): Either<Unit, Unit> =>
  pipe(
    compileFromFile_(file, agents),
    either.map(json => console.log(JSON.stringify(json, null, 2))),
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
      : compileFromFile_(file, agents),
    e => taskEither.fromEither<error.DSLError | error.FormattedErrors, compiler.Json>(e),
    taskEither.flatMap(json => runFromJson(json, agents)),
    taskEither.map(() => unit),
    taskEither.orElse(e => taskEither.fromEither(handleError(e))),
  );
