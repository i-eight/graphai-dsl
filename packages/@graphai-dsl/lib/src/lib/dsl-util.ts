import { pipe } from 'fp-ts/lib/function';
import { Json } from './compiler';
import { readonlyArray, readonlyRecord } from 'fp-ts';

export const toReadableJson = (value: Json): Json =>
  typeof value === 'number' ||
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  value == null
    ? value
    : value instanceof Array
      ? value.map(toReadableJson)
      : pipe(
          readonlyRecord.toEntries(value),
          readonlyArray.reduce({}, (obj, [k, v]) =>
            k === 'context' || (k === 'annotations' && v instanceof Array && v.length === 0)
              ? obj
              : { ...obj, [k]: toReadableJson(v) },
          ),
        );
