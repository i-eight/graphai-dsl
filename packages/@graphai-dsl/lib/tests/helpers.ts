import { apply, pipe } from 'fp-ts/lib/function';
import {
  NestedGraph,
  ComputedNode,
  Expr,
  Graph,
  AgentContext,
  StaticNode,
  ComputedNodeBody,
  File,
  Import,
  Statements,
  NativeImport,
  Destructuring,
  ObjectPairDestructuring,
} from '../src/lib/dsl-syntax-tree';
import { Json } from '../src/lib/compiler';
import { either, readonlyArray, task, taskEither } from 'fp-ts';
import { Either } from 'fp-ts/lib/Either';
import { runFromJson } from '../src/lib/run';
import { DSLError, ParserError } from '../src/lib/error';
import { file } from '../src/lib/dsl-parser';
import { source, stream } from '../src/lib/stream';
import { compiler } from '../src/lib';
import { through } from '../src/lib/through';
import { agents } from '../src/agents';
import fs from 'fs';
import { unit } from '../src/lib/unit';
import { Parser, parser } from '../src/lib/parser-combinator';

export const printJson = (json: unknown): void => console.log(JSON.stringify(json, null, 2));

export const toTupleFromExpr = (
  _:
    | Expr
    | File
    | Import
    | NativeImport
    | Graph
    | Statements
    | NestedGraph
    | AgentContext
    | StaticNode
    | ComputedNode
    | ComputedNodeBody
    | Destructuring,
): unknown => {
  if (_ instanceof Array) {
    return _.map(toTupleFromExpr);
  } else {
    switch (_.type) {
      case 'IfThenElse':
        return {
          if: toTupleFromExpr(_.if),
          then: toTupleFromExpr(_.then),
          else: toTupleFromExpr(_.else),
        };
      case 'Paren':
        return [toTupleFromExpr(_.expr)];
      case 'Identifier':
        return _.name;
      case 'Boolean':
      case 'Number':
        return _.value;
      case 'Null':
        return null;
      case 'String':
        return pipe(
          _.value,
          readonlyArray.map(_ => (typeof _ === 'string' ? _ : toTupleFromExpr(_))),
        );
      case 'Array':
        return _.value.map(toTupleFromExpr);
      case 'Object':
        return pipe(
          _.value.map(_ => [_.key.name, toTupleFromExpr(_.value)]),
          Object.fromEntries,
        );
      case 'ArrayAt':
        return { array: toTupleFromExpr(_.array), at: toTupleFromExpr(_.index) };
      case 'ObjectMember':
        return { object: toTupleFromExpr(_.object), member: _.key.name };
      case 'AgentContext':
        return { name: _.name.name, value: toTupleFromExpr(_.value) };
      case 'AgentCall':
        return _.args == null
          ? { agentContext: _.agentContext.map(toTupleFromExpr), agent: toTupleFromExpr(_.agent) }
          : {
              agentContext: _.agentContext.map(toTupleFromExpr),
              agent: toTupleFromExpr(_.agent),
              args: toTupleFromExpr(_.args),
            };
      case 'ArrayDestructuring':
        return {
          arrayDestrcuturing: {
            heads: pipe(_.value, readonlyArray.map(toTupleFromExpr)),
            rest: _.rest == null ? null : toTupleFromExpr(_.rest),
          },
        };
      case 'ObjectDestructuring':
        return {
          objectDestructuring: {
            heads: pipe(
              _.value,
              readonlyArray.map(_ =>
                _.type === 'Identifier'
                  ? toTupleFromExpr(_)
                  : [toTupleFromExpr(_.key), toTupleFromExpr(_.value)],
              ),
            ),
            rest: _.rest == null ? null : toTupleFromExpr(_.rest),
          },
        };
      case 'AgentDef':
        return {
          def:
            _.args == null
              ? null
              : _.args?.type === 'Identifier'
                ? _.args.name
                : toTupleFromExpr(_.args),
          body: toTupleFromExpr(_.body),
        };
      case 'Pipeline':
      case 'Logical':
      case 'Equality':
      case 'Relational':
      case 'PlusMinus':
      case 'MulDivMod':
        return [toTupleFromExpr(_.left), _.operator, toTupleFromExpr(_.right)];
      case 'Power':
        return [toTupleFromExpr(_.base), '^', toTupleFromExpr(_.exponent)];
      case 'StaticNode':
        return { staticNode: _.name.name, value: toTupleFromExpr(_.value) };
      case 'ComputedNode':
        return _.name
          ? { computedNode: _.name.name, body: toTupleFromExpr(_.body) }
          : { anonNode: toTupleFromExpr(_.body) };
      case 'NestedGraph':
        return {
          nested: toTupleFromExpr(_.graph),
        };
      case 'Graph':
        return _.statements.map(toTupleFromExpr);
      case 'Import':
        return { import: _.path, as: _.as?.name };
      case 'NativeImport':
        return { import: _.path, as: _.as.name };
      case 'File':
        return {
          imports: _.imports?.map(toTupleFromExpr),
          graph: toTupleFromExpr(_.graph),
        };
    }
  }
};

export const toTupleFromCompileError = (
  _: DSLError,
): Either<[string, string | undefined], unknown> =>
  either.left([_.type, _.type === 'CompileError' ? _.items[0].message : _.message]);

export const parseFileTest = (path: string): Either<ParserError, File> =>
  pipe(fs.readFileSync(path, 'utf-8'), src => parseSourceTest(src, path));

export const runParser =
  <A>(p: Parser<A>) =>
  (src: string): Either<ParserError, A> =>
    pipe(
      p,
      parser.run(stream.create(source.of('', src))),
      either.map(_ => _.data),
    );

export const parseSourceTest = (src: string, path: string = ''): Either<ParserError, File> =>
  pipe(
    file(path),
    parser.run(stream.create(source.of(path, src))),
    either.map(_ => _.data),
  );

export const compileFileTest =
  (result: Either<DSLError, Json> | undefined = undefined) =>
  (file: Either<ParserError, File>): Either<DSLError | ParserError, Json> =>
    pipe(
      file,
      either.flatMap(_ => pipe(_, compiler.fileToJson, compiler.run(agents))),
      either.map(([{ json }]) => json),
      through(_ => (result == null ? _ : expect(_).toStrictEqual(result))),
    );

export const runFileTest =
  (
    result:
      | Either<unknown, unknown>
      | ((f: Either<unknown, unknown>) => void)
      | undefined = undefined,
  ) =>
  (json: Either<unknown, Json>): Promise<void> =>
    pipe(json, async _ =>
      typeof result === 'function'
        ? result(_)
        : pipe(
            _,
            either.match(
              async e => expect(e).toStrictEqual(result),
              async _ =>
                pipe(
                  runFromJson(_, agents),
                  taskEither.map(r => expect(either.right(r)).toStrictEqual(result)),
                  taskEither.orElse(e =>
                    taskEither.of(expect(either.left(e)).toStrictEqual(result)),
                  ),
                  task.map(_ => void 0),
                  apply(unit),
                ),
            ),
          ),
    );

export const getValue = (result: Either<unknown, Json>): Either<unknown, Json> =>
  pipe(
    result,
    either.map(v => (v != null && typeof v === 'object' ? Object.values(v) : v)),
  );
