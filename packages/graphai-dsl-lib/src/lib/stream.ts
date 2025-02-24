import { option } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { Option } from 'fp-ts/lib/Option';
import os from 'os';

export type Stream = Readonly<{
  source: Source;
  position: Position;
}>;

export type Source = Readonly<{
  path: string;
  data: string;
}>;

export type Position = Readonly<{
  index: number;
  row: number;
  column: number;
}>;

export namespace source {
  export const of = (path: string, data: string): Source => ({ path, data });
  export const fromData = (data: string): Source => ({ path: '', data });
}

export namespace stream {
  export const is = (_: unknown): _ is Stream =>
    typeof _ === 'object' && _ !== null && 'source' in _ && 'position' in _;

  export const create = (source: Source): Stream => ({
    source,
    position: { index: 0, row: 1, column: 1 },
  });

  export const fromData = (data: string): Stream => create(source.fromData(data));

  const updateRowCol = ({
    source,
    position,
  }: Readonly<{ source: Source; position: Position }>): Stream =>
    pipe(isEOL(source, position.index - 1), _ => ({
      source,
      position: {
        index: position.index,
        row: _ ? position.row + 1 : position.row,
        column: _ ? 1 : position.column,
      },
    }));

  export const isEOL = (source: Source, index: number): boolean => source.data[index] === os.EOL;

  export const head = (self: Stream): Option<string> =>
    option.fromNullable(self.source.data[self.position.index]);

  export const tail = ({ source, position }: Stream): Stream =>
    updateRowCol({
      source,
      position: { index: position.index + 1, row: position.row, column: position.column + 1 },
    });
}
