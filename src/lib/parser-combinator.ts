import { Either } from 'fp-ts/lib/Either';
import { Position, Source, Stream } from './stream';
import { either, option } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { Option } from 'fp-ts/lib/Option';
import { Unit } from './unit';
import { loop, Recur, recur } from './loop';

export type ParserData<A> = Readonly<{
  stream: Stream;
  data: A;
}>;

export type BaseError = UnexpectedError | NotImplementedError | InvalidSyntaxError;

export type ParserError = BaseError & Readonly<{ position: Position }>;

export type UnexpectedError = Readonly<{
  type: 'UnexpectedParserError';
  expect?: string;
  actual?: string;
  message?: string;
  cause?: ParserError;
}>;

export type NotImplementedError = Readonly<{
  type: 'NotImplementedError';
  message: string;
  cause?: ParserError;
}>;

export type InvalidSyntaxError = Readonly<{
  type: 'InvalidSyntaxError';
  message: string;
  cause?: ParserError;
}>;

export type ParserResult<A> = Either<ParserError, ParserData<A>>;

export type Parser<A> = Readonly<{
  parse: (stream: Stream) => ParserResult<A>;
}>;

export type ParserContext = Readonly<{
  source: Source;
  start: Position;
  end: Position;
}>;

export namespace error {
  export const getActual = (self: ParserError): string =>
    self.type === 'UnexpectedParserError' ? (self.actual ?? '?') : '?';
}

export namespace parser {
  export const create = <A>(parse: (stream: Stream) => ParserResult<A>): Parser<A> => ({
    parse,
  });

  export const of = <A>(data: A): Parser<A> => create(s => either.right({ stream: s, data }));

  export const fail = <A>(error: BaseError): Parser<A> =>
    create(s => either.left({ ...error, position: s.position } as ParserError));

  export const run =
    <A>(stream: Stream) =>
    (self: Parser<A>): ParserResult<A> =>
      self.parse(stream);

  export const flatMap =
    <A, B>(f: (a: A) => Parser<B>) =>
    (self: Parser<A>): Parser<B> =>
      create(s =>
        pipe(
          self,
          run(s),
          either.flatMap(({ stream, data }) => pipe(f(data), run(stream))),
        ),
      );

  export const tap =
    <A, B>(f: (a: A) => Parser<B>) =>
    (self: Parser<A>): Parser<A> =>
      pipe(
        self,
        flatMap(a =>
          pipe(
            f(a),
            map(() => a),
          ),
        ),
      );

  export const map =
    <A, B>(f: (a: A) => B) =>
    (self: Parser<A>): Parser<B> =>
      pipe(
        self,
        flatMap(a => of(f(a))),
      );

  export const unit: Parser<Unit> = of({ type: 'Unit' });

  export const bind =
    <N extends string, A, B>(name: Exclude<N, keyof A>, f: (a: A) => Parser<B>) =>
    (self: Parser<A>): Parser<Readonly<{ [K in keyof A | N]: K extends keyof A ? A[K] : B }>> =>
      pipe(
        self,
        flatMap(a =>
          pipe(
            f(a),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            map(b => ({ ...a, [name]: b }) as any),
          ),
        ),
      );

  export const orElse =
    <A>(f: (error: ParserError) => Parser<A>) =>
    (self: Parser<A>): Parser<A> =>
      create(s =>
        pipe(
          self,
          run(s),
          either.orElse(e1 =>
            pipe(
              f(e1),
              run(s),
              either.orElse(e2 =>
                e1.position.index > e2.position.index ? either.left(e1) : either.left(e2),
              ),
            ),
          ),
        ),
      );

  export const or =
    <A>(p: Parser<A>) =>
    (self: Parser<A>): Parser<A> =>
      pipe(
        self,
        orElse(() => p),
      );

  export const optional = <A>(self: Parser<A>): Parser<Option<A>> =>
    pipe(
      self,
      map(a => option.some(a)),
      orElse(() => of<Option<A>>(option.none)),
    );

  export const getStream: Parser<Stream> = create(stream => either.right({ stream, data: stream }));

  export const mapWithContext =
    <A, B>(f: (a: A, context: ParserContext) => B) =>
    (self: Parser<A>): Parser<B> =>
      pipe(
        unit,
        bind('start', () => getStream),
        bind('a', () => self),
        bind('end', () => getStream),
        map(({ start, a, end }) =>
          f(a, { source: start.source, start: start.position, end: end.position }),
        ),
      );

  export const context =
    <A, B>(f: (a: A) => B) =>
    (self: Parser<A>): Parser<B & Readonly<{ context: ParserContext }>> =>
      pipe(
        self,
        mapWithContext((a, context) => ({
          ...f(a),
          context,
        })),
      );

  export const notFollowedBy = <A>(self: Parser<A>): Parser<Unit> =>
    create(s =>
      pipe(
        self,
        run(s),
        either.match(
          () => either.right({ stream: s, data: { type: 'Unit' } }),
          a =>
            either.left({
              type: 'UnexpectedParserError',
              message: `Expect not followed by ${a}`,
              position: s.position,
            }),
        ),
      ),
    );

  export const left =
    <A, B>(p: Parser<B>) =>
    (self: Parser<A>): Parser<A> =>
      pipe(
        self,
        flatMap(a =>
          pipe(
            p,
            map(_ => a),
          ),
        ),
      );

  export const right =
    <A, B>(p: Parser<B>) =>
    (self: Parser<A>): Parser<B> =>
      pipe(
        self,
        flatMap(_ =>
          pipe(
            p,
            map(b => b),
          ),
        ),
      );

  export const repeat = <A>(init: A, f: (acc: A) => Parser<A>) =>
    create<A>(s =>
      pipe(
        loop({ stream: s, data: init }, result =>
          pipe(
            f(result.data),
            run(result.stream),
            either.match(
              () =>
                ({
                  stream: result.stream,
                  data: result.data,
                }) as Recur<ParserData<A>> | ParserData<A>,
              ({ stream, data }) => recur({ stream, data }),
            ),
          ),
        ),
        either.right,
      ),
    );

  export const repeat1 = <A>(init: A, f: (acc: A) => Parser<A>) =>
    pipe(
      f(init),
      flatMap(a => repeat(a, f)),
    );

  export const many = <A>(self: Parser<A>): Parser<ReadonlyArray<A>> =>
    repeat<ReadonlyArray<A>>([], (xs: ReadonlyArray<A>) =>
      pipe(
        self,
        map(a => [...xs, a]),
      ),
    );

  export const many1 = <A>(self: Parser<A>): Parser<ReadonlyArray<A>> =>
    pipe(
      self,
      flatMap(a =>
        pipe(
          many(self),
          map(as => [a, ...as]),
        ),
      ),
    );

  export const startBy =
    <B>(delim: Parser<B>) =>
    <A>(self: Parser<A>): Parser<ReadonlyArray<A>> =>
      pipe(
        delim,
        flatMap(_ => self),
        many,
      );

  export const sepBy1 =
    <B>(delim: Parser<B>) =>
    <A>(self: Parser<A>): Parser<ReadonlyArray<A>> =>
      pipe(
        self,
        flatMap(a =>
          pipe(
            self,
            startBy(delim),
            map(xs => [a, ...xs]),
          ),
        ),
      );

  export const sepBy =
    <B>(delim: Parser<B>) =>
    <A>(self: Parser<A>): Parser<ReadonlyArray<A>> =>
      pipe(
        self,
        sepBy1(delim),
        orElse(() => of<ReadonlyArray<A>>([])),
      );
}
