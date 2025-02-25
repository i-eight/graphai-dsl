import { Either } from 'fp-ts/lib/Either';
import { DSLError } from './error';
import { either } from 'fp-ts';
import fs from 'fs';

export const readFile = (path: string): Either<DSLError, string> => {
  try {
    return either.of(fs.readFileSync(path, 'utf-8'));
  } catch (e) {
    return either.left<DSLError>({
      type: 'SystemError',
      message: `Failed to read '${path}': ${String(e)}`,
    });
  }
};
