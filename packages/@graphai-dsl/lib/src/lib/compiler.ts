import { identity, pipe } from 'fp-ts/lib/function';
import {
  AgentCall,
  AgentDef,
  ArrayAt,
  ComputedNode,
  ComputedNodeBody,
  DSLArray,
  DSLBoolean,
  DSLNull,
  DSLNumber,
  DSLObject,
  DSLObjectPair,
  DSLString,
  Equality,
  Expr,
  Graph,
  Identifier,
  IfThenElse,
  Import,
  Logical,
  MulDivMod,
  NestedGraph,
  Node,
  AgentContext,
  ObjectMember,
  Paren,
  Pipeline,
  PlusMinus,
  Power,
  RawString,
  Relational,
  Statements,
  StaticNode,
  File,
  NativeImport,
  ArrayDestructuring,
  ObjectDestructuring,
  Destructuring,
  ObjectPairDestructuring,
  TermEquality,
  Match,
  TryCatch,
  MatchCase,
} from './dsl-syntax-tree';
import { either, option, readonlyArray, readonlyRecord, string } from 'fp-ts';
import { parser, ParserRange, ParserData } from './parser-combinator';
import { StateEither, stateEither as se } from './state-either';
import { unit, Unit } from './unit';
import { Either } from 'fp-ts/lib/Either';
import { Option } from 'fp-ts/lib/Option';
import { file } from './dsl-parser';
import { source, Source, stream } from './stream';
import fs from 'fs';
import { AgentFunctionInfo, AgentFunctionInfoDictionary } from 'graphai';
import nodePath from 'path';
import { ReadonlyRecord } from 'fp-ts/lib/ReadonlyRecord';
import { DSLError, CompileErrorItem } from './error';
import { readFile } from './file';
import {
  newAgentCall,
  newAgentDef,
  newArray,
  newArrayAt,
  newBoolean,
  newComputedNode,
  newEquality,
  newError,
  newGraph,
  newIdentifier,
  newIfThenElse,
  newModifier,
  newNestedGraph,
  newNull,
  newNumber,
  newObject,
  newObjectMember,
  newParen,
  newString,
  newTryCatch,
  toReadableJson,
} from './dsl-util';

export type Json = number | string | boolean | JsonArray | JsonObject | null | undefined;

export type JsonArray = ReadonlyArray<Json>;

export type JsonObject = Readonly<{
  [Key in string]: Json;
}>;

export type StackItem = ComputedNode | StaticNode | AgentFunctionInfo | Identifier;
export type StackItems = Readonly<Record<string, StackItem>>;
export type Stack = Readonly<{
  items: StackItems;
  parent?: Stack;
}>;

export type Context = Readonly<{
  stack: Stack;
  nodeIndex: number;
  imports: ReadonlyRecord<string, Statements>;
  currentNode?: Node;
}>;

export type Captures = Readonly<Record<string, Identifier>>;

export type CompileData<A = Json> = Readonly<{
  // A JSON representation of the DSL
  json: A;
  // Identifiers to be captured from the parent stack
  captures: Captures;
  // Nodes to be defined in the graph
  nodes: JsonObject;
  lastNodeName?: string;
}>;

export type State = Readonly<{
  nodeIndex: number;
}>;

export type Result<A = CompileData> = StateEither<Context, DSLError, A>;

namespace result {
  export const of = <A>(a: A): Result<A> => se.right<Context, DSLError, A>(a);
  export const fromEither = <A>(e: Either<DSLError, A>): Result<A> =>
    se.fromEither<Context, DSLError, A>(e);
  export const Do = of<Unit>(unit);
  export const left = <A>(e: DSLError): Result<A> => se.left<Context, DSLError, A>(e);
  export const get = (): Result<Context> => se.get<Context, DSLError>();
  export const put = (context: Context) => se.put<Context, DSLError>(context);
  export const modify = (f: (context: Context) => Context) => se.modify<Context, DSLError>(f);
  export const debug = <A>(f: (a: A) => string) =>
    se.tap<Context, DSLError, A, void>(a => of(console.log(f(a))));
}

const newJsonObject = (): JsonObject => ({});

const newStack = (items: StackItems = {}, parent: Stack | undefined = undefined): Stack => ({
  items,
  parent,
});

const newCapures = (): Captures => ({});

const getAnnonName = (): Result<string> =>
  pipe(
    se.get<Context, DSLError>(),
    se.tap(() => se.modify(s => ({ ...s, nodeIndex: s.nodeIndex + 1 }))),
    se.map(({ nodeIndex }) => `__anon${nodeIndex}__`),
  );

const putGraphStack = (graph: Graph, agentArgs: ReadonlyArray<Identifier> = []): Result<Unit> =>
  pipe(
    result.get(),
    se.flatMap(s =>
      pipe(
        // Extract node's names in this graph
        result.of(graph.statements),
        se.flatMap(
          readonlyArray.reduce(result.of<StackItems>({}), (fmap, _) =>
            pipe(
              fmap,
              se.flatMap(map =>
                _.name == null
                  ? result.of(map)
                  : readonlyRecord.has(_.name.name, map)
                    ? result.left({
                        type: 'CompileError',
                        items: [
                          {
                            message: `Identifier '${_.name.name}' is already defined`,
                            parserContext: _.name.context,
                          },
                        ],
                      })
                    : result.of({ ...map, [_.name.name]: _ }),
              ),
            ),
          ),
        ),
        se.map(identifiers =>
          identity<Stack>({
            items: identity<StackItems>({
              ...identifiers,
              ...pipe(
                agentArgs,
                readonlyArray.reduce<Identifier, StackItems>({}, (obj, arg) => ({
                  ...obj,
                  [arg.name]: arg,
                })),
              ),
            }),
            parent: s.stack,
          }),
        ),
        se.map(stack => identity<Context>({ ...s, stack })),
      ),
    ),
    se.flatMap(result.put),
  );

const popStack = (): Result<Unit> =>
  se.modify<Context, DSLError>(s => ({ ...s, stack: s.stack.parent ?? newStack() }));

const updateCurrentNode = (node: Node): Result<Unit> =>
  se.modify<Context, DSLError>(s => ({ ...s, currentNode: node }));

const deleteCurrentNode = (): Result<Unit> =>
  se.modify<Context, DSLError>(s => ({ ...s, currentNode: undefined }));

const findIdentifierRecur = (name: Identifier, stack: Stack): Option<StackItem> =>
  pipe(
    readonlyRecord.lookup(name.name, stack.items),
    option.orElse(() => (stack.parent ? findIdentifierRecur(name, stack.parent) : option.none)),
  );

const isIdentifier = (item: StackItem): boolean => {
  const a = item as ComputedNode | StaticNode | Identifier;
  return a.type === 'Identifier' || a.type === 'StaticNode' || a.type === 'ComputedNode';
};

const findIdentifier = (
  name: Identifier,
  stack: Stack,
): 'InThisStack' | 'InParentStacks' | 'NativeAgent' | 'None' =>
  pipe(
    readonlyRecord.lookup(name.name, stack.items),
    option.match(
      () =>
        stack.parent
          ? pipe(
              findIdentifierRecur(name, stack.parent),
              option.match(
                () => 'None',
                _ => (isIdentifier(_) ? 'InParentStacks' : 'NativeAgent'),
              ),
            )
          : 'None',
      _ => (isIdentifier(_) ? 'InThisStack' : 'NativeAgent'),
    ),
  );

export const compileFromFile = (
  path: string,
  agents: AgentFunctionInfoDictionary,
): Either<DSLError, Json> =>
  pipe(
    readFile(path),
    either.flatMap(_ => compileFromString(source.of(path, _), agents)),
  );

export const compileFromString = (
  src: Source,
  agents: AgentFunctionInfoDictionary,
): Either<DSLError, Json> =>
  pipe(
    file(src.path),
    parser.run({ stream: stream.create(src) }),
    either.flatMap(({ data }) => pipe(data, addEmbeddedAgentsToGraph, fileToJson, run(agents))),
    either.map(([_]) => _.json),
  );

export const compileFromStringOrThrow = (src: Source, agents: AgentFunctionInfoDictionary): Json =>
  pipe(
    compileFromFile(src.path, agents),
    either.match(e => {
      throw e;
    }, identity),
  );

export const run =
  (agents: AgentFunctionInfoDictionary) =>
  (self: Result): Either<DSLError, [CompileData, Context]> =>
    self({
      stack: newStack(agents),
      nodeIndex: 0,
      imports: {},
    });

export const embeddedAgent = (name: string, agent: string) => ({ name, agent });

export const embeddedAgents: ReadonlyArray<{ name: string; agent: string }> = [
  embeddedAgent('Array', 'arrayAgent'),
  embeddedAgent('Object', 'objectAgent'),
  embeddedAgent('Date', 'dateAgent'),
  embeddedAgent('Json', 'jsonAgent'),
];

export const addEmbeddedAgentsToGraph = (file: File): File => ({
  ...file,
  graph: {
    ...file.graph,
    statements: [
      ...pipe(
        embeddedAgents,
        readonlyArray.map(({ name, agent }) =>
          pipe(file.graph.context, ctx =>
            newComputedNode(
              {
                name: newIdentifier({ name }, ctx),
                modifiers: [newModifier({ value: 'private' }, ctx)],
                body: newAgentCall(
                  {
                    agentContext: [],
                    agent: newIdentifier({ name: agent }, ctx),
                  },
                  ctx,
                ),
              },
              ctx,
            ),
          ),
        ),
      ),
      ...file.graph.statements,
    ],
  },
});

export const fileToJson = (file: File): Result =>
  pipe(
    result.Do,
    se.flatMap(() => importsToStatements(file.imports ?? [], nodePath.dirname(file.path))),
    se.flatMap(statements =>
      graphToJson({
        ...file.graph,
        statements: [...statements, ...file.graph.statements],
      }),
    ),
  );

const importFromPath = (path: string): Result<Statements> =>
  pipe(
    fs.readFileSync(path, 'utf-8'),
    data =>
      pipe(file(path), parser.run({ stream: stream.create(source.of(path, data)) }), _ =>
        result.fromEither<ParserData<File>>(_),
      ),
    se.let_('file_', _ => _.data),
    se.let_('ss1', ({ file_ }) => file_.graph.statements),
    se.tap(({ ss1 }) =>
      result.modify(_ =>
        pipe(_.imports, readonlyRecord.upsertAt(path, ss1), imports => ({ ..._, imports })),
      ),
    ),
    se.bind('ss2', ({ file_ }) => importsToStatements(file_.imports ?? [], nodePath.dirname(path))),
    se.map(({ ss1, ss2 }) => [...ss2, ...ss1] as Statements),
  );

const statementsToPublicPairs = (
  s: Statements,
): ReadonlyArray<
  Readonly<{
    key: Identifier;
    value: Expr;
  }>
> =>
  pipe(
    s,
    readonlyArray.flatMap(n =>
      n.name == null
        ? []
        : pipe(
              n.modifiers,
              readonlyArray.exists(m => m.value === 'public'),
            )
          ? [
              {
                key: n.name,
                value: n.name,
              },
            ]
          : [],
    ),
  );

const importsToObject = (s: Statements, context: ParserRange): NestedGraph => ({
  type: 'NestedGraph',
  graph: {
    type: 'Graph',
    statements: [
      ...s,
      {
        type: 'ComputedNode',
        modifiers: [],
        body: {
          type: 'Object',
          value: statementsToPublicPairs(s),
          context,
        },
        context,
      },
    ],
    context,
  },
  context,
});

const exportAsObject = (s: Statements, name: Identifier): Node => ({
  type: 'ComputedNode',
  modifiers: [],
  name,
  body: importsToObject(s, name.context),
  context: name.context,
});

const objectToNodes = (s: Statements, name: Identifier): Statements =>
  pipe(
    statementsToPublicPairs(s),
    readonlyArray.map(pair => ({
      type: 'ComputedNode',
      modifiers: [],
      name: pair.key,
      body: {
        type: 'ObjectMember',
        annotations: [],
        object: name,
        key: pair.key,
        context: name.context,
      },
      context: name.context,
    })),
  );

const isAbsoluteImport = (path: string): boolean => path.startsWith('/');
const isRelativeImport = (path: string): boolean => path.startsWith('.');
const isPackageImport = (path: string): boolean =>
  !isAbsoluteImport(path) && !isRelativeImport(path);

const pathExists = (path: string): boolean => {
  try {
    fs.accessSync(path, fs.constants.F_OK);
    return true;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    return false;
  }
};

const getPackageFilePath = (
  importPath: string,
  currentDir: string,
  parserContext: ParserRange,
): Result<string> =>
  pipe(
    result.of(nodePath.resolve(currentDir)),
    se.flatMap(path =>
      pipe(
        fs.readdirSync(path),
        readonlyArray.exists(_ => _ === 'node_modules'),
        _ =>
          _
            ? pipe(nodePath.resolve(path, 'node_modules', importPath), path2 =>
                pathExists(path2)
                  ? result.of(path2)
                  : getPackageFilePath(importPath, nodePath.resolve(path, '..'), parserContext),
              )
            : path === '/'
              ? result.left<string>({
                  type: 'CompileError',
                  items: [{ message: 'node_modules not found', parserContext }],
                })
              : getPackageFilePath(importPath, nodePath.resolve(path, '..'), parserContext),
      ),
    ),
  );

export const importToStatements = (import_: Import, currentDir: string): Result<Statements> =>
  pipe(
    isPackageImport(import_.path)
      ? getPackageFilePath(import_.path, currentDir, import_.context)
      : result.of(nodePath.resolve(currentDir, import_.path)),
    se.flatMap(path =>
      pipe(
        result.get(),
        se.map(_ => pipe(_.imports, readonlyRecord.lookup(path))),
        se.flatMap(option.match(() => importFromPath(path), se.right)),
      ),
    ),
    se.flatMap(s =>
      pipe(
        option.fromNullable(import_.as),
        option.match(
          () =>
            pipe(
              getAnnonName(),
              se.map(name =>
                identity<Identifier>({
                  type: 'Identifier',
                  name,
                  context: import_.context,
                }),
              ),
              se.map(name => [exportAsObject(s, name), ...objectToNodes(s, name)]),
            ),
          name => result.of([exportAsObject(s, name)]),
        ),
      ),
    ),
  );

export const nativeImportToStatements = (
  import_: NativeImport,
  currentDir: string,
): Result<Statements> =>
  pipe(
    result.of<string>(
      import_.path.startsWith('/') ? import_.path : nodePath.resolve(currentDir, import_.path),
    ),
    se.map(path => [
      identity<Node>({
        type: 'ComputedNode',
        modifiers: [],
        name: import_.as,
        body: {
          type: 'AgentCall',
          agentContext: [],
          agent: {
            type: 'Identifier',
            name: 'nativeImportAgent',
            context: import_.context,
          },
          args: {
            type: 'Object',
            value: [
              {
                key: {
                  type: 'Identifier',
                  name: 'path',
                  context: import_.context,
                },
                value: {
                  type: 'String',
                  value: [path],
                  context: import_.context,
                },
              },
            ],
            context: import_.context,
          },
          context: import_.context,
        },
        context: import_.context,
      }),
    ]),
  );

export const importsToStatements = (
  imports: ReadonlyArray<Import | NativeImport>,
  currentDir: string,
): Result<Statements> =>
  pipe(
    result.Do,
    se.flatMap(() =>
      pipe(
        imports,
        readonlyArray.reduce(result.of<Statements>([]), (fss, import_) =>
          pipe(
            result.Do,
            se.bind('ss1', () => fss),
            se.bind('ss2', () =>
              import_.type === 'Import'
                ? importToStatements(import_, currentDir)
                : nativeImportToStatements(import_, currentDir),
            ),
            se.map(({ ss1, ss2 }) => [...ss1, ...ss2]),
          ),
        ),
      ),
    ),
  );

export const graphToJson = (
  graph: Graph,
  options: Readonly<{
    agentArgs?: ReadonlyArray<Identifier>;
  }> = {},
): Result =>
  pipe(
    putGraphStack(graph, options.agentArgs ?? []),
    se.map(() => ({
      json: newJsonObject(),
      captures: newCapures(),
      lastNodeName: '',
      index: 0,
    })),
    // Convert the statements to a JSON
    init =>
      pipe(
        graph.statements,
        readonlyArray.reduce(init, (res, node_) =>
          pipe(
            res,
            se.let_(
              'isLastNode',
              ({ index }) => node_.type === 'ComputedNode' && index === graph.statements.length - 1,
            ),
            se.let_('node', () => node_),
            se.bind('name', ({ node }) =>
              node.name == null
                ? getAnnonName()
                : se.right<Context, DSLError, string>(node.name.name),
            ),
            // Convert the node to a JSON
            se.tap(({ node }) => updateCurrentNode(node)),
            se.bind('jsonNode', ({ node }) => nodeToJson(node)),
            se.tap(() => deleteCurrentNode()),
            se.map(({ index, json, captures, name, jsonNode, isLastNode }) => ({
              json: {
                ...json,
                ...jsonNode.nodes,
                [name]: isLastNode
                  ? {
                      ...(jsonNode.json as JsonObject),
                      isResult: true,
                    }
                  : jsonNode.json,
              },
              captures: { ...captures, ...jsonNode.captures },
              lastNodeName: name,
              index: index + 1,
            })),
          ),
        ),
      ),
    se.map(({ json, captures, lastNodeName }) => ({
      json: {
        ...(graph.version == null ? {} : { version: graph.version }),
        nodes: json,
      },
      captures,
      nodes: newJsonObject(),
      lastNodeName,
    })),
    se.tap(() => popStack()),
  );

export const nodeToJson = (node: Node): Result => {
  switch (node.type) {
    case 'StaticNode':
      return staticNodeToJson(node.value);
    case 'ComputedNode':
      return computedNodeToJson(node.body);
  }
};

export const staticNodeToJson = (expr: Expr): Result =>
  pipe(
    exprToJson(expr),
    se.map(_ => ({
      json: {
        value: _.json,
      },
      captures: _.captures,
      nodes: _.nodes,
    })),
  );

export const computedNodeToJson = (body: ComputedNodeBody): Result<CompileData<JsonObject>> =>
  body.type === 'NestedGraph' ? nestedGraphToJson(body) : computedNodeBodyExprToJson(body);

export const computedNodeBodyExprToJson = (expr: Expr): Result<CompileData<JsonObject>> => {
  switch (expr.type) {
    case 'IfThenElse':
      return ifThenElseToJson(expr);
    case 'TryCatch':
      return tryCatchToJson(expr);
    case 'Match':
      return matchToJson(expr);
    case 'Paren':
      return computedNodeParenToJson(expr);
    case 'NestedGraph':
      return nestedGraphToJson(expr);
    case 'AgentDef':
      return agentDefToJson(expr);
    case 'Pipeline':
      return pipelineToJson(expr);
    case 'Logical':
      return logicalToJson(expr);
    case 'Equality':
      return equalityToJson(expr);
    case 'Relational':
      return relationalToJson(expr);
    case 'PlusMinus':
      return plusMinusToJson(expr);
    case 'MulDivMod':
      return mulDivModToJson(expr);
    case 'Power':
      return powerToJson(expr);
    case 'ArrayAt':
      return arrayAtToJson(expr);
    case 'ObjectMember':
      return objectMemberToJson(expr);
    case 'AgentCall':
      return applyAgentToJson(expr);
    case 'String':
      return computedNodeStringToJson(expr);
    default:
      return exprToJson(
        identity<AgentCall>({
          type: 'AgentCall',
          agentContext: [],
          agent: {
            type: 'Identifier',
            name: 'identity',
            context: expr.context,
          },
          args: expr,
          context: expr.context,
        }),
      ) as Result<CompileData<JsonObject>>;
  }
};

export const exprToJson = (expr: Expr): Result => {
  switch (expr.type) {
    case 'IfThenElse':
      return ifThenElseToJson(expr);
    case 'TryCatch':
      return tryCatchToJson(expr);
    case 'Match':
      return matchToJson(expr);
    case 'Paren':
      return parenToJson(expr);
    case 'NestedGraph':
      return nestedGraphToJson(expr);
    case 'ArrayAt':
      return arrayAtToJson(expr);
    case 'ObjectMember':
      return objectMemberToJson(expr);
    case 'AgentCall':
      return applyAgentToJson(expr);
    case 'AgentDef':
      return agentDefToJson(expr);
    case 'Pipeline':
      return pipelineToJson(expr);
    case 'Logical':
      return logicalToJson(expr);
    case 'Equality':
      return equalityToJson(expr);
    case 'Relational':
      return relationalToJson(expr);
    case 'PlusMinus':
      return plusMinusToJson(expr);
    case 'MulDivMod':
      return mulDivModToJson(expr);
    case 'Power':
      return powerToJson(expr);
    case 'Identifier':
      return identifierToJson(expr);
    case 'Boolean':
      return booleanToJson(expr);
    case 'Number':
      return numberToJson(expr);
    case 'Null':
      return nullToJson(expr);
    case 'RawString':
      return rawStringToJson(expr);
    case 'String':
      return stringToJson(expr);
    case 'Array':
      return arrayToJson(expr);
    case 'Object':
      return objectToJson(expr);
  }
};

export const agentContextToJson = (
  agentContext: ReadonlyArray<AgentContext>,
): Result<
  Readonly<{
    json: JsonObject;
    nodes: JsonObject;
  }>
> =>
  pipe(
    agentContext,
    readonlyArray.reduce(
      se.right<
        Context,
        DSLError,
        Readonly<{
          json: JsonObject;
          nodes: JsonObject;
        }>
      >({
        json: newJsonObject(),
        nodes: newJsonObject(),
      }),
      (result, annon) =>
        pipe(
          result,
          // Get the annotation's value
          se.bind('value', () => exprToJson(annon.value)),
          // Check if all the identifiers are in the stack
          se.tap(({ value }) =>
            pipe(
              se.get<Context, DSLError>(),
              se.flatMap(({ stack }) =>
                pipe(
                  value.captures,
                  readonlyRecord.reduce(string.Ord)(
                    identity<ReadonlyArray<CompileErrorItem>>([]),
                    (xs, value) =>
                      readonlyRecord.has(value.name, stack.items)
                        ? xs
                        : [
                            ...xs,
                            {
                              message: `Identifier not found: ${value.name}`,
                              parserContext: value.context,
                            },
                          ],
                  ),
                  items =>
                    readonlyArray.size(items) === 0
                      ? se.right<Context, DSLError, Unit>(unit)
                      : se.left<Context, DSLError, Unit>(
                          identity<DSLError>({
                            type: 'CompileError',
                            items,
                          }),
                        ),
                ),
              ),
            ),
          ),
          se.map(({ json, nodes, value }) => ({
            json: {
              ...json,
              [annon.name.name]: value.json,
            },
            nodes: { ...nodes, ...value.nodes },
          })),
        ),
    ),
  );

export const nestedGraphToJson = (graph: NestedGraph): Result<CompileData<JsonObject>> =>
  pipe(
    result.of<Unit>(unit),
    // Convert the nested graph to a JSON
    se.bind('jsonGraph', () => graphToJson(graph.graph)),
    // Find the identifiers to be captured from the parent stack
    // inputs: { name: ':name' }
    se.bind('inputsCaptures', ({ jsonGraph }) =>
      pipe(
        jsonGraph.captures,
        readonlyRecord.reduce(string.Ord)(
          result.of({
            inputs: newJsonObject(),
            captures: newCapures(),
          }),
          (fobj, value) =>
            pipe(
              fobj,
              se.flatMap(({ inputs, captures }) =>
                pipe(
                  result.get(),
                  se.flatMap(({ stack }) =>
                    pipe(
                      stack.items,
                      readonlyRecord.lookup(value.name),
                      option.match(
                        // If the identifier is not found in this stack,
                        // tell the parent stack to capture it
                        // and tell the child graph to be able to use it through the inputs
                        () =>
                          stack.parent == null
                            ? result.left({
                                type: 'CompileError',
                                items: [
                                  {
                                    message: `Identifier not found: ${value.name}`,
                                    parserContext: value.context,
                                  },
                                ],
                              })
                            : se.right({
                                inputs: { ...inputs, [value.name]: `:${value.name}` },
                                captures: { ...captures, [value.name]: value },
                              }),
                        // If the identifier is found in this stack,
                        // You don't need to ask the parent stack to capture it
                        // and tell the child graph to use it through the inputs
                        _ =>
                          se.right({
                            inputs: { ...inputs, [value.name]: `:${value.name}` },
                            captures,
                          }),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ),
      ),
    ),
    se.bind('name', () => getAnnonName()),
    se.map(({ jsonGraph, inputsCaptures: { inputs, captures }, name }) => ({
      json: {
        agent: 'getObjectMemberAgent',
        inputs: {
          object: `:${name}`,
          key: jsonGraph.lastNodeName,
        },
      },
      captures,
      nodes: {
        [name]: {
          isResult: false,
          agent: 'nestedAgent',
          inputs,
          graph: jsonGraph.json,
        },
      },
    })),
  );

export const ifThenElseToJson = (ifThenElse: IfThenElse): Result<CompileData<JsonObject>> =>
  pipe(
    se.right<Context, DSLError, Unit>(unit),
    se.bind('ctx', () => se.get()),
    se.bind('if_', () =>
      exprToJson({
        type: 'AgentDef',
        body: ifThenElse.if.type === 'NestedGraph' ? ifThenElse.if.graph : ifThenElse.if,
        context: ifThenElse.if.context,
      }),
    ),
    se.bind('ifNode', () => getAnnonName()),
    se.bind('then_', () =>
      exprToJson({
        type: 'AgentDef',
        body: ifThenElse.then.type === 'NestedGraph' ? ifThenElse.then.graph : ifThenElse.then,
        context: ifThenElse.then.context,
      }),
    ),
    se.bind('thenNode', () => getAnnonName()),
    se.bind('else_', () =>
      exprToJson({
        type: 'AgentDef',
        body: ifThenElse.else.type === 'NestedGraph' ? ifThenElse.else.graph : ifThenElse.else,
        context: ifThenElse.else.context,
      }),
    ),
    se.bind('elseNode', () => getAnnonName()),
    se.map(({ if_, ifNode, then_, thenNode, else_, elseNode }) => ({
      json: identity<JsonObject>({
        agent: 'caseAgent',
        inputs: {
          conditions: [{ if: `:${ifNode}`, then: `:${thenNode}` }, { else: `:${elseNode}` }],
        },
      }),
      captures: {
        ...if_.captures,
        ...then_.captures,
        ...else_.captures,
      },
      nodes: {
        ...if_.nodes,
        ...then_.nodes,
        ...else_.nodes,
        [ifNode]: if_.json,
        [thenNode]: then_.json,
        [elseNode]: else_.json,
      },
    })),
  );

export const tryCatchToJson = (tryCatch: TryCatch): Result<CompileData<JsonObject>> =>
  agentCallToJson(
    newAgentCall(
      {
        agentContext: [],
        agent: newIdentifier({ name: 'tryCatch' }, tryCatch.context),
        args: newObject(
          {
            value: [
              {
                key: newIdentifier({ name: 'try' }, tryCatch.try.context),
                value: newAgentDef({ body: tryCatch.try }, tryCatch.try.context),
              },
              ...(tryCatch.catch == null
                ? []
                : [
                    {
                      key: newIdentifier({ name: 'catch' }, tryCatch.catch.context),
                      value: tryCatch.catch,
                    },
                  ]),
              ...(tryCatch.finally == null
                ? []
                : [
                    {
                      key: newIdentifier({ name: 'finally' }, tryCatch.finally.context),
                      value: newAgentDef({ body: tryCatch.finally }, tryCatch.finally.context),
                    },
                  ]),
            ],
          },
          tryCatch.context,
        ),
      },
      tryCatch.context,
    ),
  );

/*
match a {
  1 -> true,
  {a, 2} -> true,
  _ -> false,
};

{
  case1 = try { matched: true, result: patt1(a) } catch () -> { matched: false }; 
  case2 = if case1.matched
          then case1
          else try { matched: true, result: patt2(a) } catch () -> { matched: false }; 
  case3 = if case2.matched
          then case2
          else try { matched: true, result: patt3(a) } catch () -> { matched: false }; 
}
*/
export const matchToJson = (match: Match): Result<CompileData<JsonObject>> =>
  pipe(
    match.cases,
    readonlyArray.reduce(
      pipe(
        getAnnonName(),
        se.map(_ => newIdentifier({ name: _ }, match.value.context)),
        se.map(argName => ({
          argName,
          result: [
            newComputedNode(
              {
                modifiers: [],
                name: argName,
                body: match.value,
              },
              match.value.context,
            ),
          ] as ReadonlyArray<ComputedNode>,
          prev: option.none as Option<Identifier>,
        })),
      ),
      (facc, case_) =>
        pipe(
          facc,
          se.bind('name', () =>
            pipe(
              getAnnonName(),
              se.map(_ => newIdentifier({ name: _ }, case_.context)),
            ),
          ),
          se.bind('caseBody', ({ argName }) => createMatchCase(argName, case_)),
          se.let_('node', ({ prev, name, caseBody }) =>
            newComputedNode(
              {
                modifiers: [],
                name,
                body: pipe(
                  prev,
                  option.match(
                    () => caseBody as Expr,
                    _ =>
                      newIfThenElse(
                        {
                          if: newObjectMember(
                            {
                              object: _,
                              key: newIdentifier({ name: 'matched' }, case_.context),
                            },
                            case_.context,
                          ),
                          then: _,
                          else: caseBody,
                        },
                        case_.context,
                      ) as Expr,
                  ),
                ),
              },
              case_.context,
            ),
          ),
          se.map(({ argName, result, node, name }) => ({
            argName,
            result: [...result, node],
            prev: option.some(name),
          })),
        ),
    ),
    se.map(({ result, prev }) =>
      pipe(
        newGraph(
          {
            statements: [
              ...result,
              ...pipe(
                prev,
                option.match(
                  () => [],
                  name => [
                    newComputedNode(
                      {
                        modifiers: [],
                        body: pipe(
                          newObjectMember(
                            {
                              object: name,
                              key: newIdentifier({ name: 'matched' }, match.context),
                            },
                            match.context,
                          ),
                          matched =>
                            newIfThenElse(
                              {
                                if: matched,
                                then: newNull({}, match.context),
                                else: newAgentCall(
                                  {
                                    agentContext: [],
                                    agent: newIdentifier({ name: 'throw' }, match.context),
                                    args: newString(
                                      {
                                        value: [
                                          "'",
                                          match.value,
                                          "'",
                                          ' does not match any pattern',
                                        ],
                                      },
                                      match.context,
                                    ),
                                  },
                                  match.context,
                                ),
                              },
                              match.context,
                            ),
                        ),
                      },
                      match.context,
                    ),
                    newComputedNode(
                      {
                        modifiers: [],
                        body: name,
                      },
                      match.context,
                    ),
                  ],
                ),
              ),
            ],
          },
          match.context,
        ),
        graph =>
          newAgentCall(
            {
              agentContext: [],
              agent: newParen(
                {
                  expr: newAgentDef(
                    {
                      body: graph,
                    },
                    match.context,
                  ),
                },
                match.context,
              ),
            },
            match.context,
          ),
      ),
    ),
    se.map(g =>
      newObjectMember(
        {
          object: g,
          key: newIdentifier({ name: 'result' }, match.context),
        },
        match.context,
      ),
    ),
    se.flatMap(objectMemberToJson),
  );

export const createMatchCase = (argName: Identifier, case_: MatchCase): Result<TryCatch> =>
  pipe(
    destructuringToNodes(argName, case_.pattern),
    se.map(xs => [
      ...xs,
      newComputedNode(
        {
          modifiers: [],
          body: case_.body,
        },
        case_.body.context,
      ),
    ]),
    se.map(pattern =>
      newTryCatch(
        {
          try: newObject(
            {
              value: [
                {
                  key: newIdentifier({ name: 'matched' }, case_.pattern.context),
                  value: newBoolean({ value: true }, case_.pattern.context),
                },
                {
                  key: newIdentifier({ name: 'result' }, case_.pattern.context),
                  value: newAgentCall(
                    {
                      agentContext: [],
                      agent: newParen(
                        {
                          expr: newAgentDef(
                            {
                              body: newGraph(
                                {
                                  statements: pattern,
                                },
                                case_.pattern.context,
                              ),
                            },
                            case_.pattern.context,
                          ),
                        },
                        case_.pattern.context,
                      ),
                    },
                    case_.pattern.context,
                  ),
                },
              ],
            },
            case_.pattern.context,
          ),
          catch: newAgentDef(
            {
              body: newObject(
                {
                  value: [
                    {
                      key: newIdentifier({ name: 'matched' }, case_.context),
                      value: newBoolean({ value: false }, case_.context),
                    },
                  ],
                },
                case_.context,
              ),
            },
            case_.context,
          ),
        },
        case_.context,
      ),
    ),
  );

export const parenToJson = (paren: Paren): Result => exprToJson(paren.expr);

export const computedNodeParenToJson = (paren: Paren): Result<CompileData<JsonObject>> =>
  pipe(
    result.Do,
    se.bind('expr', () => computedNodeToJson(paren.expr)),
    se.map(({ expr }) => ({
      json: {
        ...expr.json,
      },
      captures: expr.captures,
      nodes: expr.nodes,
    })),
  );

export const applyAgentToJson = (agentCall: AgentCall): Result<CompileData<JsonObject>> =>
  agentCallToJson({
    type: 'AgentCall',
    agentContext: agentCall.agentContext,
    agent: {
      type: 'Identifier',
      name: 'apply',
      context: agentCall.context,
    },
    args: {
      type: 'Object',
      value: [
        {
          key: {
            type: 'Identifier',
            name: 'agent',
            context: agentCall.agent.context,
          },
          value: agentCall.agent,
        },
        {
          key: {
            type: 'Identifier',
            name: 'args',
            context: agentCall.args?.context ?? agentCall.context,
          },
          value: agentCall.args ?? {
            type: 'Object',
            value: [],
            context: agentCall.context,
          },
        },
      ],
      context: agentCall.context,
    },
    context: agentCall.context,
  });

export const agentCallToJson = (agentCall: AgentCall): Result<CompileData<JsonObject>> =>
  pipe(
    result.Do,
    se.bind('agentContext', () =>
      pipe(
        agentContextToJson(agentCall.agentContext),
        se.map(_ => ('graph' in _.json ? _ : { ..._, json: { ..._.json, graph: {} } })),
      ),
    ),
    se.bind('agent', () => {
      switch (agentCall.agent.type) {
        case 'Identifier':
          return identifierToJson(agentCall.agent);
        default:
          return pipe(
            result.Do,
            se.bind('call', () => {
              switch (agentCall.agent.type) {
                case 'AgentCall':
                  return applyAgentToJson(agentCall.agent as AgentCall);
                case 'ArrayAt':
                  return arrayAtToJson(agentCall.agent as ArrayAt);
                case 'ObjectMember':
                  return objectMemberToJson(agentCall.agent as ObjectMember);
                case 'Paren':
                  return parenToJson(agentCall.agent as Paren);
                default:
                  return exprToJson(agentCall.agent);
              }
            }),
            se.bind('name', () => getAnnonName()),
            se.map(({ call, name }) => ({
              json: `:${name}`,
              captures: call.captures,
              nodes: {
                ...call.nodes,
                [name]: call.json,
              },
            })),
          );
      }
    }),
    // An agent is called in the argument object of this agent call
    // e.g. agent1({ value: agent2() })
    se.bind('nestedAgentCall', () =>
      pipe(agentCall.args?.type, _ =>
        _ === 'Boolean' || _ === 'Number' || _ === 'String' || _ === 'Array'
          ? result.left({
              type: 'CompileError',
              items: [
                {
                  message: `${_} can not be used as inputs of an anget`,
                  parserContext: agentCall.context,
                },
              ],
            })
          : _ === 'Object' || _ === 'Identifier' || _ == null
            ? result.of(false)
            : result.of(true),
      ),
    ),
    se.bind('args', () =>
      agentCall.args == null
        ? result.of({
            json: undefined,
            captures: {},
            nodes: {},
          })
        : exprToJson(agentCall.args),
    ),
    se.flatMap(({ agentContext, agent, args, nestedAgentCall }) =>
      nestedAgentCall
        ? pipe(
            getAnnonName(),
            se.map(agentName => ({
              json: {
                ...agentContext.json,
                agent: agent.json,
                inputs: `:${agentName}`,
              },
              captures: {
                ...agent.captures,
                ...args.captures,
              },
              nodes: {
                ...agent.nodes,
                ...args.nodes,
                [agentName]: args.json,
              },
            })),
          )
        : result.of({
            json:
              args.json == null
                ? {
                    ...agentContext.json,
                    agent: agent.json,
                  }
                : {
                    ...agentContext.json,
                    agent: agent.json,
                    inputs: args.json,
                  },
            captures: {
              ...agent.captures,
              ...args.captures,
            },
            nodes: {
              ...agent.nodes,
              ...args.nodes,
            },
          }),
    ),
  );

/*
argName = [a, b, [c, d], { e, f }, ...g]
pair = Array.aplitAt(4, argName)
heads = pair[0]
rest = pair[1]
a = heads[0]
b = heads[1]
anon1 = heads[2]
nodes1 = arrayDesturcturingToNodes(anon1, heads[2])
anon1 = heads[3]
nodes2 = objectDestructuringToNodes(anon2, heads[3])
[a, b, ...nodes1, ...nodes2, rest]
*/
const arrayDestructuringToNodes = (
  argName: Identifier,
  array: ArrayDestructuring,
): Result<ReadonlyArray<ComputedNode>> =>
  pipe(
    result.Do,
    se.let_('ctx', () => array.context),
    se.bind('heads', ({ ctx }) =>
      pipe(
        getAnnonName(),
        se.map(_ => newIdentifier({ name: _ }, ctx)),
      ),
    ),
    // nodes1 = [heads] or [heads, rest]
    se.bind('nodes1', ({ heads, ctx }) =>
      arrayDestructuringToHeadsRest(argName, array, heads, ctx),
    ),
    se.flatMap(({ heads, nodes1, ctx }) =>
      pipe(
        array.value,
        readonlyArray.reduce(
          result.of<[ReadonlyArray<ComputedNode>, number]>([nodes1, 0]),
          (fout, item) =>
            pipe(
              fout,
              se.map(([nodes1, idx]) => ({ nodes1, idx })),
              se.bind('nodes2', ({ idx }) => arrayDestructuringEachItem(item, heads, idx, ctx)),
              se.map(
                ({ nodes1, nodes2, idx }) =>
                  [[...nodes1, ...nodes2], idx + 1] satisfies [ReadonlyArray<ComputedNode>, number],
              ),
            ),
        ),
        se.map(_ => _[0]),
      ),
    ),
  );

const arrayDestructuringToHeadsRest = (
  argName: Identifier,
  array: ArrayDestructuring,
  heads: Identifier,
  ctx: ParserRange,
): Result<ReadonlyArray<ComputedNode>> =>
  pipe(
    result.Do,
    se.let_('frest', () => option.fromNullable(array.rest)),
    se.let_('checkType', () => destructuringTypeCheck(argName, 'isArray', ctx)),
    se.flatMap(({ frest, checkType }) =>
      pipe(
        frest,
        option.match(
          // heads = argName;
          () =>
            result.of([
              checkType,
              newComputedNode({ name: heads, modifiers: [], body: argName }, ctx),
            ]),
          // pair = splitAt(array.value.length, argName);
          // heads = pair[0];
          // rest = pair[1];
          rest =>
            pipe(
              // define pair
              getAnnonName(),
              se.map(_ => newIdentifier({ name: _ }, ctx)),
              se.map(pair => [
                checkType,
                newComputedNode(
                  {
                    name: pair,
                    modifiers: [],
                    body: pipe(
                      // fill the first arguments of the splitAt with the length of the array:
                      // splitAt(length)
                      newAgentCall(
                        {
                          agentContext: [],
                          agent: newIdentifier({ name: 'arraySplitAt' }, ctx),
                          args: newNumber({ value: array.value.length }, ctx),
                        },
                        ctx,
                      ),
                      // fill the second arguments of the splitAt with the array:
                      // f(argName)
                      f =>
                        newAgentCall(
                          {
                            agentContext: [],
                            agent: f,
                            args: argName,
                          },
                          ctx,
                        ),
                    ),
                  },
                  ctx,
                ),
                newComputedNode(
                  {
                    name: heads,
                    modifiers: [],
                    body: newArrayAt(
                      {
                        array: pair,
                        index: newNumber({ value: 0 }, ctx),
                      },
                      ctx,
                    ),
                  },
                  ctx,
                ),
                newComputedNode(
                  {
                    name: rest,
                    modifiers: [],
                    body: newArrayAt(
                      {
                        array: pair,
                        index: newNumber({ value: 1 }, ctx),
                      },
                      ctx,
                    ),
                  },
                  ctx,
                ),
              ]),
            ),
        ),
      ),
    ),
  );

const arrayDestructuringEachItem = (
  item: Destructuring,
  heads: Identifier,
  idx: number,
  ctx: ParserRange,
): Result<ReadonlyArray<ComputedNode>> => {
  switch (item.type) {
    case 'Number':
    case 'String':
    case 'Boolean':
    case 'Null':
      return destructuringMatch(
        item,
        newArrayAt(
          {
            array: heads,
            index: newNumber({ value: idx }, ctx),
          },
          ctx,
        ),
        ctx,
      );
    case 'Identifier':
      return result.of([
        newComputedNode(
          {
            name: item,
            modifiers: [],
            body: newArrayAt(
              {
                array: heads,
                index: newNumber({ value: idx }, ctx),
              },
              ctx,
            ),
          },
          ctx,
        ),
      ]);
    default:
      return pipe(
        result.Do,
        // define node name
        se.bind('name', () =>
          pipe(
            getAnnonName(),
            se.map(_ => newIdentifier({ name: _ }, ctx)),
          ),
        ),
        // name = heads[idx]
        se.let_('node', ({ name }) =>
          newComputedNode(
            {
              name,
              modifiers: [],
              body: newArrayAt(
                {
                  array: heads,
                  index: newNumber({ value: idx }, ctx),
                },
                ctx,
              ),
            },
            ctx,
          ),
        ),
        se.bind('nestdNodes', ({ name }) =>
          item.type === 'ArrayDestructuring'
            ? arrayDestructuringToNodes(name, item)
            : objectDestructuringToNodes(name, item),
        ),
        se.map(({ node, nestdNodes }) => [node, ...nestdNodes]),
      );
  }
};

/*
argName = {a, b, c: [d, e], f: {g, h}, i: j, ...k}
pair = Object.take(['a', 'b', 'c', 'f'], argName)
heads = pair[0]
rest = pair[1]
a = heads.a
b = heads.b
anon1 = heads.c
nodes1 = arrayDesturcturingToNodes(anon1, heads.c)
anon2 = heads.f
nodes2 = objectDestructuringToNodes(anon2, heads.f)
anon3 = heads.i
j = anon3
[a, b, ...nodes1, ...nodes2, j, rest]
*/
const objectDestructuringToNodes = (
  argName: Identifier,
  object: ObjectDestructuring,
): Result<ReadonlyArray<ComputedNode>> =>
  pipe(
    result.Do,
    se.let_('ctx', () => object.context),
    se.bind('heads', ({ ctx }) =>
      pipe(
        getAnnonName(),
        se.map(_ => newIdentifier({ name: _ }, ctx)),
      ),
    ),
    // [heads] or [heads, rest]
    se.bind('nodes1', ({ heads, ctx }) =>
      objectDestructuringToHeadsRest(argName, object, heads, ctx),
    ),
    // define nodes for each key in the object
    se.flatMap(({ heads, nodes1, ctx }) =>
      pipe(
        object.value,
        readonlyArray.reduce(
          result.of<[ReadonlyArray<ComputedNode>, number]>([nodes1, 0]),
          // each item in the object
          (fout, item) =>
            pipe(
              fout,
              se.map(([nodes1, idx]) => ({ nodes1, idx })),
              se.bind('nodes2', () => objectDestructuringEachItem(item, heads, ctx)),
              se.map(
                ({ nodes1, nodes2, idx }) =>
                  [[...nodes1, ...nodes2], idx + 1] satisfies [ReadonlyArray<ComputedNode>, number],
              ),
            ),
        ),
        se.map(_ => _[0]),
      ),
    ),
  );

const objectDestructuringToHeadsRest = (
  argName: Identifier,
  object: ObjectDestructuring,
  heads: Identifier,
  ctx: ParserRange,
): Result<ReadonlyArray<ComputedNode>> =>
  pipe(
    option.fromNullable(object.rest),
    option.match(
      // heads = argName;
      () =>
        result.of([
          destructuringTypeCheck(argName, 'isObject', ctx),
          newComputedNode({ name: heads, modifiers: [], body: argName }, ctx),
        ]),
      // pair = take(['a', 'b', ...], argName);
      // heads = pair[0];
      // rest = pair[1];
      rest =>
        pipe(
          // define pair
          getAnnonName(),
          se.map(_ => newIdentifier({ name: _ }, ctx)),
          se.map(pair => [
            destructuringTypeCheck(argName, 'isObject', ctx),
            newComputedNode(
              {
                name: pair,
                modifiers: [],
                body: pipe(
                  // fill the first arguments of the take with the keys of the object:
                  // take(keys)
                  newAgentCall(
                    {
                      agentContext: [],
                      agent: newIdentifier({ name: 'objectTake' }, ctx),
                      args: newArray(
                        {
                          value: pipe(
                            object.value,
                            readonlyArray.map(kv =>
                              kv.type === 'Identifier'
                                ? newString({ value: [kv.name] }, ctx)
                                : newString({ value: [kv.key.name] }, ctx),
                            ),
                          ),
                        },
                        ctx,
                      ),
                    },
                    ctx,
                  ),
                  // fill the second arguments of the take with the array:
                  // f(argName)
                  f =>
                    newAgentCall(
                      {
                        agentContext: [],
                        agent: f,
                        args: argName,
                      },
                      ctx,
                    ),
                ),
              },
              ctx,
            ),
            // define heads: heads = pair[0];
            newComputedNode(
              {
                name: heads,
                modifiers: [],
                body: newArrayAt(
                  {
                    array: pair,
                    index: newNumber({ value: 0 }, ctx),
                  },
                  ctx,
                ),
              },
              ctx,
            ),
            // define rest: rest = pair[1];
            newComputedNode(
              {
                name: rest,
                modifiers: [],
                body: newArrayAt(
                  {
                    array: pair,
                    index: newNumber({ value: 1 }, ctx),
                  },
                  ctx,
                ),
              },
              ctx,
            ),
          ]),
        ),
    ),
  );

const objectDestructuringEachItem = (
  item: Identifier | ObjectPairDestructuring,
  heads: Identifier,
  ctx: ParserRange,
): Result<ReadonlyArray<ComputedNode>> => {
  switch (item.type) {
    case 'Identifier':
      // define a node for the item: a = heads.a
      return result.of([
        newComputedNode(
          {
            name: item,
            modifiers: [],
            body: newObjectMember(
              {
                object: heads,
                key: item,
              },
              ctx,
            ),
          },
          ctx,
        ),
      ]);
    default: // define nodes for the item: c: [d, e] or f: {g, h}
      return pipe(
        result.Do,
        se.bind('name', () =>
          pipe(
            getAnnonName(),
            se.map(_ => newIdentifier({ name: _ }, ctx)),
          ),
        ),
        // name = heads.c
        se.let_('node', ({ name }) =>
          newComputedNode(
            {
              name,
              modifiers: [],
              body: newObjectMember(
                {
                  object: heads,
                  key: item.key,
                },
                ctx,
              ),
            },
            ctx,
          ),
        ),
        se.bind('nestdNodes', ({ name }) => {
          switch (item.value.type) {
            case 'Number':
            case 'String':
            case 'Boolean':
            case 'Null':
              return destructuringMatch(item.value, name, ctx);
            case 'Identifier':
              return result.of([
                newComputedNode(
                  {
                    name: item.value,
                    modifiers: [],
                    body: name,
                  },
                  ctx,
                ),
              ]);
            case 'ArrayDestructuring':
              return arrayDestructuringToNodes(name, item.value);
            default:
              return objectDestructuringToNodes(name, item.value);
          }
        }),
        se.map(({ node, nestdNodes }) => [node, ...nestdNodes]),
      );
  }
};

const destructuringToNodes = (
  argName: Identifier,
  value: Destructuring,
): Result<ReadonlyArray<ComputedNode>> => {
  switch (value.type) {
    case 'Number':
    case 'String':
    case 'Boolean':
    case 'Null':
      return destructuringMatch(value, argName, value.context);
    case 'Identifier':
      return result.of([
        newComputedNode(
          {
            modifiers: [],
            name: value,
            body: argName,
          },
          value.context,
        ),
      ]);
    case 'ArrayDestructuring':
      return arrayDestructuringToNodes(argName, value);
    default:
      return objectDestructuringToNodes(argName, value);
  }
};

const destructuringMatch = (
  item: DSLNumber | DSLString | DSLBoolean | DSLNull,
  value: TermEquality,
  ctx: ParserRange,
): Result<ReadonlyArray<ComputedNode>> =>
  result.of([
    newComputedNode(
      {
        modifiers: [],
        body: pipe(
          {
            x: value,
            eq: newEquality(
              {
                left: value,
                right: item,
                operator: '==',
              },
              ctx,
            ),
          },
          ({ x, eq }) =>
            newIfThenElse(
              {
                if: eq,
                then: value,
                else: newAgentCall(
                  {
                    agentContext: [],
                    agent: newIdentifier({ name: 'throw' }, ctx),
                    args: newString(
                      {
                        value: [`Failed to match a pattern `, item, ` with `, x],
                      },
                      ctx,
                    ),
                  },
                  ctx,
                ),
              },
              ctx,
            ),
        ),
      },
      ctx,
    ),
  ]);

const destructuringTypeCheck = (
  argName: Identifier,
  agentName: 'isArray' | 'isObject',
  ctx: ParserRange,
): ComputedNode =>
  newComputedNode(
    {
      modifiers: [],
      body: pipe(
        newAgentCall(
          {
            agentContext: [],
            agent: newIdentifier({ name: agentName }, ctx),
            args: argName,
          },
          ctx,
        ),
        test =>
          newIfThenElse(
            {
              if: test,
              then: newNull({}, ctx),
              else: newAgentCall(
                {
                  agentContext: [],
                  agent: newIdentifier({ name: 'throw' }, ctx),
                  args: newString(
                    {
                      value: [
                        "'",
                        argName,
                        "'",
                        ` is not an ${agentName === 'isArray' ? 'Array' : 'Object'}`,
                      ],
                    },
                    ctx,
                  ),
                },
                ctx,
              ),
            },
            ctx,
          ),
      ),
    },
    ctx,
  );

export const agentDefToJson = (agentDef: AgentDef): Result<CompileData<JsonObject>> =>
  pipe(
    result.Do,
    se.let_(
      'agentContext',
      () =>
        ({
          type: 'Identifier',
          name: '@context',
          context: agentDef.context,
        }) satisfies Identifier,
    ),
    se.bind('argName', () =>
      agentDef.args?.type === 'Identifier' ? result.of(agentDef.args.name) : getAnnonName(),
    ),
    se.bind('destructuring', ({ argName }) =>
      pipe(
        option.fromNullable(agentDef.args),
        option.match(
          () => result.of([]),
          args =>
            args.type === 'Identifier'
              ? result.of([])
              : destructuringToNodes(newIdentifier({ name: argName }, args.context), args),
        ),
      ),
    ),
    se.bind('graph', ({ agentContext, destructuring, argName }) =>
      graphToJson(
        agentDef.body.type === 'Graph'
          ? {
              ...agentDef.body,
              statements: [...destructuring, ...agentDef.body.statements],
            }
          : {
              type: 'Graph',
              statements: [
                ...destructuring,
                {
                  type: 'ComputedNode',
                  modifiers: [],
                  body: agentDef.body,
                  context: agentDef.body.context,
                },
              ],
              context: agentDef.body.context,
            },
        {
          agentArgs: [
            agentContext,
            ...(agentDef.args == null
              ? []
              : [newIdentifier({ name: argName }, agentDef.args.context)]),
          ],
        },
      ),
    ),
    se.let_('captures', ({ graph, argName }) =>
      pipe(
        graph.captures,
        readonlyRecord.filter(value => value.name !== argName),
      ),
    ),
    se.bind('captures2', ({ graph, argName }) =>
      pipe(
        result.Do,
        se.bind('ctx', () => result.get()),
        se.map(({ ctx }) =>
          pipe(
            graph.captures,
            readonlyRecord.filter(v =>
              pipe(
                ctx.stack.items,
                readonlyRecord.lookup(v.name),
                option.match(
                  () => v.name !== argName,
                  // if the identifier is found in the stack,
                  // don't tell the parent stack to capture it
                  () => false,
                ),
              ),
            ),
          ),
        ),
      ),
    ),
    se.map(({ graph, captures, captures2, argName }) => ({
      json: {
        agent: 'defAgent',
        inputs: {
          args: agentDef.args == null ? undefined : argName,
          capture: pipe(
            captures,
            readonlyRecord.map(value => `:${value.name}`),
          ),
          return: [graph.lastNodeName],
        },
        graph: graph.json,
      },
      captures: captures2,
      nodes: graph.nodes,
    })),
  );

export const pipelineToJson = (pipeline: Pipeline): Result<CompileData<JsonObject>> =>
  agentCallToJson({
    type: 'AgentCall',
    agentContext: [],
    agent: {
      type: 'Identifier',
      name: (() => {
        switch (pipeline.operator) {
          case '|>':
            return 'barRightArrowAgent';
          case '-->':
            return 'hyphenHyphenRightArrowAgent';
          case '>>':
            return 'rightArrowRightArrowAgent';
          case '>>=':
            return 'rightArrowRightArrowEqualAgent';
          case '>>-':
            return 'rightArrowRightArrowHyphenAgent';
          case '->>':
            return 'hyphenRightArrowRightArrowAgent';
          case ':>':
            return 'colonRightArrowAgent';
        }
      })(),
      context: pipeline.context,
    },
    args: {
      type: 'Object',
      value: [
        {
          key: {
            type: 'Identifier',
            name: 'left',
            context: pipeline.left.context,
          },
          value: pipeline.left,
        },
        {
          key: {
            type: 'Identifier',
            name: 'right',
            context: pipeline.right.context,
          },
          value: pipeline.right,
        },
      ],
      context: pipeline.context,
    },
    context: pipeline.context,
  });

export const logicalToJson = (logical: Logical): Result<CompileData<JsonObject>> =>
  agentCallToJson({
    type: 'AgentCall',
    agentContext: [],
    agent: {
      type: 'Identifier',
      name: logical.operator === '&&' ? 'andAgent' : 'orAgent',
      context: logical.context,
    },
    args: {
      type: 'Object',
      value: [
        {
          key: {
            type: 'Identifier',
            name: 'left',
            context: logical.left.context,
          },
          value: logical.left,
        },
        {
          key: {
            type: 'Identifier',
            name: 'right',
            context: logical.right.context,
          },
          value: logical.right,
        },
      ],
      context: logical.context,
    },
    context: logical.context,
  });

export const equalityToJson = (equality: Equality): Result<CompileData<JsonObject>> =>
  agentCallToJson({
    type: 'AgentCall',
    agentContext: [],
    agent: {
      type: 'Identifier',
      name: (() => {
        switch (equality.operator) {
          case '==':
            return 'eqAgent';
          case '!=':
            return 'neqAgent';
        }
      })(),
      context: equality.context,
    },
    args: {
      type: 'Object',
      value: [
        {
          key: {
            type: 'Identifier',
            name: 'left',
            context: equality.left.context,
          },
          value: equality.left,
        },
        {
          key: {
            type: 'Identifier',
            name: 'right',
            context: equality.right.context,
          },
          value: equality.right,
        },
      ],
      context: equality.context,
    },
    context: equality.context,
  });

export const relationalToJson = (relational: Relational): Result<CompileData<JsonObject>> =>
  agentCallToJson({
    type: 'AgentCall',
    agentContext: [],
    agent: {
      type: 'Identifier',
      name: (() => {
        switch (relational.operator) {
          case '<':
            return 'ltAgent';
          case '<=':
            return 'lteAgent';
          case '>':
            return 'gtAgent';
          case '>=':
            return 'gteAgent';
        }
      })(),
      context: relational.context,
    },
    args: {
      type: 'Object',
      value: [
        {
          key: {
            type: 'Identifier',
            name: 'left',
            context: relational.left.context,
          },
          value: relational.left,
        },
        {
          key: {
            type: 'Identifier',
            name: 'right',
            context: relational.right.context,
          },
          value: relational.right,
        },
      ],
      context: relational.context,
    },
    context: relational.context,
  });

export const plusMinusToJson = (plusMinus: PlusMinus): Result<CompileData<JsonObject>> =>
  agentCallToJson({
    type: 'AgentCall',
    agentContext: [],
    agent: {
      type: 'Identifier',
      name: plusMinus.operator === '+' ? 'plusAgent' : 'minusAgent',
      context: plusMinus.context,
    },
    args: {
      type: 'Object',
      value: [
        {
          key: {
            type: 'Identifier',
            name: 'left',
            context: plusMinus.left.context,
          },
          value: plusMinus.left,
        },
        {
          key: {
            type: 'Identifier',
            name: 'right',
            context: plusMinus.right.context,
          },
          value: plusMinus.right,
        },
      ],
      context: plusMinus.context,
    },
    context: plusMinus.context,
  });

export const mulDivModToJson = (mulDivMod: MulDivMod): Result<CompileData<JsonObject>> =>
  agentCallToJson({
    type: 'AgentCall',
    agentContext: [],
    agent: {
      type: 'Identifier',
      name: (() => {
        switch (mulDivMod.operator) {
          case '*':
            return 'mulAgent';
          case '/':
            return 'divAgent';
          case '%':
            return 'modAgent';
        }
      })(),
      context: mulDivMod.context,
    },
    args: {
      type: 'Object',
      value: [
        {
          key: {
            type: 'Identifier',
            name: 'left',
            context: mulDivMod.left.context,
          },
          value: mulDivMod.left,
        },
        {
          key: {
            type: 'Identifier',
            name: 'right',
            context: mulDivMod.right.context,
          },
          value: mulDivMod.right,
        },
      ],
      context: mulDivMod.context,
    },
    context: mulDivMod.context,
  });

export const powerToJson = (power: Power): Result<CompileData<JsonObject>> =>
  agentCallToJson({
    type: 'AgentCall',
    agentContext: [],
    agent: {
      type: 'Identifier',
      name: 'powAgent',
      context: power.context,
    },
    args: {
      type: 'Object',
      value: [
        {
          key: {
            type: 'Identifier',
            name: 'base',
            context: power.base.context,
          },
          value: power.base,
        },
        {
          key: {
            type: 'Identifier',
            name: 'exponent',
            context: power.exponent.context,
          },
          value: power.exponent,
        },
      ],
      context: power.context,
    },
    context: power.context,
  });

export const arrayAtToJson = (arrayAt: ArrayAt): Result<CompileData<JsonObject>> =>
  pipe(
    result.Do,
    se.bind('array', () =>
      pipe(
        exprToJson(arrayAt.array),
        se.flatMap(_ =>
          arrayAt.array.type === 'Identifier' || arrayAt.array.type === 'Array'
            ? result.of(_)
            : pipe(
                getAnnonName(),
                se.map(name => ({
                  json: `:${name}`,
                  captures: _.captures,
                  nodes: { ..._.nodes, [name]: _.json },
                })),
              ),
        ),
      ),
    ),
    se.bind('index', () =>
      pipe(
        exprToJson(arrayAt.index),
        se.flatMap(_ =>
          arrayAt.index.type === 'Identifier' || arrayAt.index.type === 'Number'
            ? result.of(_)
            : pipe(
                getAnnonName(),
                se.map(name => ({
                  json: `:${name}`,
                  captures: _.captures,
                  nodes: { ..._.nodes, [name]: _.json },
                })),
              ),
        ),
      ),
    ),
    se.map(({ array, index }) => ({
      json: {
        agent: 'getArrayElementAgent',
        inputs: {
          array: array.json,
          index: index.json,
        },
      },
      captures: array.captures,
      nodes: array.nodes,
    })),
  );

export const objectMemberToJson = (objectMember: ObjectMember): Result<CompileData<JsonObject>> =>
  pipe(
    result.Do,
    se.bind('object', () =>
      pipe(
        exprToJson(objectMember.object),
        se.flatMap(_ =>
          objectMember.object.type === 'Identifier' || objectMember.object.type === 'Object'
            ? result.of(_)
            : pipe(
                getAnnonName(),
                se.map(name => ({
                  json: `:${name}`,
                  captures: _.captures,
                  nodes: { ..._.nodes, [name]: _.json },
                })),
              ),
        ),
      ),
    ),
    se.map(({ object }) => ({
      json: {
        agent: 'getObjectMemberAgent',
        inputs: {
          object: object.json,
          key: objectMember.key.name,
        },
      },
      captures: object.captures,
      nodes: object.nodes,
    })),
  );

export const identifierToJson = (identifier: Identifier): Result =>
  pipe(
    se.get<Context, DSLError>(),
    se.flatMap(({ stack, currentNode }) =>
      currentNode?.name?.name === identifier.name
        ? result.left({
            type: 'CompileError',
            items: [
              {
                message: `Identifier can not be used before its definition: ${identifier.name}`,
                parserContext: identifier.context,
              },
            ],
          })
        : pipe(
            result.Do,
            se.map(() => findIdentifier(identifier, stack)),
            se.flatMap(_ =>
              _ === 'None'
                ? result.left({
                    type: 'CompileError',
                    items: [
                      {
                        message: `Identifier not found: ${identifier.name}`,
                        parserContext: identifier.context,
                      },
                    ],
                  })
                : _ === 'NativeAgent'
                  ? result.of({
                      json: identifier.name,
                      captures: newCapures(),
                      nodes: newJsonObject(),
                    })
                  : _ === 'InParentStacks'
                    ? result.of<CompileData>({
                        json: `:${identifier.name}`,
                        captures: { [identifier.name]: identifier },
                        nodes: newJsonObject(),
                      })
                    : result.of({
                        json: `:${identifier.name}`,
                        captures: newCapures(),
                        nodes: newJsonObject(),
                      }),
            ),
          ),
    ),
  );

export const booleanToJson = (boolean: DSLBoolean): Result =>
  se.right({
    json: boolean.value,
    nodes: newJsonObject(),
    captures: newCapures(),
  });

export const numberToJson = (number: DSLNumber): Result =>
  se.right({
    json: number.value,
    nodes: newJsonObject(),
    captures: newCapures(),
  });

export const rawStringToJson = (string: RawString): Result =>
  se.right({
    json: string.value,
    nodes: newJsonObject(),
    captures: newCapures(),
  });

const toRawString = (string: DSLString): Option<CompileData> =>
  pipe(
    string.value.length === 0
      ? option.some('')
      : string.value.length === 1 && typeof string.value[0] === 'string'
        ? option.fromNullable(string.value[0])
        : option.none,
    option.map(_ => ({
      json: _,
      nodes: newJsonObject(),
      captures: newCapures(),
    })),
  );

export const stringToJson = (string: DSLString): Result =>
  pipe(
    toRawString(string),
    option.match(
      () => computedNodeStringToJson(string),
      _ => result.of<CompileData>(_),
    ),
  );

export const computedNodeStringToJson = (string: DSLString): Result<CompileData<JsonObject>> =>
  agentCallToJson({
    type: 'AgentCall',
    agentContext: [],
    agent: {
      type: 'Identifier',
      name: 'concatStringAgent',
      context: string.context,
    },
    args: {
      type: 'Object',
      value: [
        {
          key: {
            type: 'Identifier',
            name: 'items',
            context: string.context,
          },
          value: {
            type: 'Array',
            value: pipe(
              string.value,
              readonlyArray.map(_ =>
                typeof _ === 'string'
                  ? {
                      type: 'RawString',
                      value: _,
                      context: string.context,
                    }
                  : _,
              ),
            ),
            context: string.context,
          },
        },
      ],
      context: string.context,
    },
    context: string.context,
  });

export const arrayToJson = (array: DSLArray): Result =>
  pipe(
    array.value,
    readonlyArray.reduce(
      result.of<CompileData<JsonArray>>({
        json: [],
        captures: newCapures(),
        nodes: newJsonObject(),
      }),
      (res, expr) =>
        pipe(
          res,
          se.bind('value', () => exprToJson(expr)),
          se.let_(
            'isRawString',
            () => expr.type === 'String' && pipe(toRawString(expr), option.isSome),
          ),
          se.flatMap(({ json, captures, nodes, value, isRawString }) =>
            expr.type === 'Identifier' ||
            expr.type === 'Boolean' ||
            expr.type === 'Number' ||
            expr.type === 'Array' ||
            expr.type === 'Object' ||
            expr.type === 'Null' ||
            expr.type === 'RawString' ||
            isRawString
              ? result.of<CompileData<JsonArray>>({
                  json: [...json, value.json],
                  captures: { ...captures, ...value.captures },
                  nodes: { ...nodes, ...value.nodes },
                })
              : pipe(
                  getAnnonName(),
                  se.map(name =>
                    identity<CompileData<JsonArray>>({
                      json: [...json, `:${name}`],
                      captures: { ...captures, ...value.captures },
                      nodes: { ...nodes, ...value.nodes, [name]: value.json },
                    }),
                  ),
                ),
          ),
        ),
    ),
  );

export const objectPairToJson = (pair: DSLObjectPair): Result<CompileData<JsonObject>> =>
  pipe(
    result.Do,
    se.bind('key', () =>
      pair.key.type === 'Identifier'
        ? result.of<CompileData>({
            json: pair.key.name,
            captures: newCapures(),
            nodes: newJsonObject(),
          })
        : stringToJson(pair.key),
    ),
    se.bind('value', () => exprToJson(pair.value)),
    se.let_(
      'isRawString',
      () => pair.value.type === 'String' && pipe(toRawString(pair.value), option.isSome),
    ),
    se.flatMap(({ key, value, isRawString }) =>
      pair.value.type === 'Identifier' ||
      pair.value.type === 'Boolean' ||
      pair.value.type === 'Number' ||
      pair.value.type === 'Array' ||
      pair.value.type === 'Object' ||
      pair.value.type === 'Null' ||
      isRawString
        ? result.of({
            json: { [key.json as string]: value.json },
            captures: value.captures,
            nodes: value.nodes,
          })
        : pipe(
            getAnnonName(),
            se.map(name => ({
              json: { [key.json as string]: `:${name}` },
              captures: {
                ...key.captures,
                ...value.captures,
              },
              nodes: {
                ...key.nodes,
                ...value.nodes,
                [name]: value.json,
              },
            })),
          ),
    ),
  );

export const objectToJson = (object: DSLObject): Result =>
  pipe(
    object.value,
    readonlyArray.reduce(
      se.right<Context, DSLError, CompileData<JsonObject>>({
        json: newJsonObject(),
        captures: newCapures(),
        nodes: newJsonObject(),
      }),
      (result, pair) =>
        pipe(
          result,
          se.bind('pair', () => objectPairToJson(pair)),
          se.map(({ json, captures, nodes, pair }) => ({
            json: { ...json, ...pair.json },
            captures: { ...captures, ...pair.captures },
            nodes: { ...nodes, ...pair.nodes },
          })),
        ),
    ),
  );

export const nullToJson = (_: DSLNull): Result =>
  se.right({
    json: null,
    nodes: newJsonObject(),
    captures: newCapures(),
  });
