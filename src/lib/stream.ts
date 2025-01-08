import { option } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { Option } from 'fp-ts/lib/Option';
import os from 'os';

export type Stream = Readonly<{
  source: string;
  position: Position;
}>;

export type Position = Readonly<{
  index: number;
  row: number;
  column: number;
}>;

export namespace stream {
  export const create = (source: string): Stream => ({
    source,
    position: { index: 0, row: 1, column: 1 },
  });

  const updateRowCol = ({
    source,
    position,
  }: Readonly<{ source: string; position: Position }>): Stream =>
    pipe(isEOL(source, position.index - 1), _ => ({
      source,
      position: {
        index: position.index,
        row: _ ? position.row + 1 : position.row,
        column: _ ? 1 : position.column,
      },
    }));

  export const isEOL = (source: string, index: number): boolean => source[index] === os.EOL;

  export const head = (self: Stream): Option<string> =>
    option.fromNullable(self.source[self.position.index]);

  export const tail = ({ source, position }: Stream): Stream =>
    updateRowCol({
      source,
      position: { index: position.index + 1, row: position.row, column: position.column + 1 },
    });
}
