import { identity, pipe } from 'fp-ts/lib/function';
import {
  AgentCall,
  AgentDef,
  ArrayAt,
  ComputedNode,
  ComputedNodeBody,
  ComputedNodeBodyExpr,
  ComputedNodeBodyParen,
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
  Logical,
  MulDivMod,
  NestedGraph,
  Node,
  NodeAnnotation,
  ObjectMember,
  Paren,
  PlusMinus,
  Power,
  RawString,
  Relational,
} from './dsl-syntax-tree';
import { either, option, readonlyArray, readonlyRecord, string } from 'fp-ts';
import { parser, ParserContext, ParserError } from './parser-combinator';
import { StateEither, stateEither as se } from './state-either';
import { unit, Unit } from './unit';
import { Either } from 'fp-ts/lib/Either';
import { Option } from 'fp-ts/lib/Option';
import { file } from './dsl-parser';
import { stream } from './stream';
import fs from 'fs';

export type Json = number | string | boolean | JsonArray | JsonObject | null | undefined;

export type JsonArray = ReadonlyArray<Json>;

export type JsonObject = Readonly<{
  [Key in string]: Json;
}>;

export type Stack = Readonly<{
  identifiers: Readonly<Record<string, Identifier>>;
  parent?: Stack;
}>;

export type Context = Readonly<{
  stack: Stack;
  nodeIndex: number;
  currentNode?: Node;
}>;

export type Captures = Readonly<Record<string, Identifier>>;

export type CompileErrorItem = Readonly<{
  message: string;
  parserContext: ParserContext;
}>;

export type CompileError = Readonly<{
  type: 'CompileError';
  items: ReadonlyArray<CompileErrorItem>;
  cause?: CompileError;
}>;

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

export type Result<A = CompileData> = StateEither<Context, CompileError, A>;

namespace result {
  export const of = <A>(a: A): Result<A> => se.right<Context, CompileError, A>(a);
  export const Do = of<Unit>(unit);
  export const left = <A>(e: CompileError): Result<A> => se.left<Context, CompileError, A>(e);
  export const get = (): Result<Context> => se.get<Context, CompileError>();
  export const debug = <A>(f: (a: A) => string) =>
    se.tap<Context, CompileError, A, void>(a => of(console.log(f(a))));
}

const newJsonObject = (): JsonObject => ({});

const newStack = (parent: Stack | undefined = undefined): Stack => ({
  identifiers: {},
  parent,
});

const newCapures = (): Captures => ({});

const getAnnonName = (): Result<string> =>
  pipe(
    se.get<Context, CompileError>(),
    se.tap(() => se.modify(s => ({ ...s, nodeIndex: s.nodeIndex + 1 }))),
    se.map(({ nodeIndex }) => `__anon${nodeIndex}__`),
  );

const putGraphStack = (graph: Graph, agentArgs: ReadonlyArray<Identifier> = []): Result<Unit> =>
  se.modify<Context, CompileError>(s =>
    pipe(
      // Extract node's names in this graph
      graph.statements,
      readonlyArray.reduce({}, (map, _) =>
        _.name == null ? map : { ...map, [_.name.name]: _.name },
      ),
      identifiers => ({
        identifiers: {
          ...identifiers,
          ...pipe(
            agentArgs,
            readonlyArray.reduce({}, (obj, arg) => ({ ...obj, [arg.name]: arg })),
          ),
        },
        parent: s.stack,
      }),
      stack => ({ ...s, stack }),
    ),
  );

const popStack = (): Result<Unit> =>
  se.modify<Context, CompileError>(s => ({ ...s, stack: s.stack.parent ?? newStack() }));

const updateCurrentNode = (node: Node): Result<Unit> =>
  se.modify<Context, CompileError>(s => ({ ...s, currentNode: node }));

const deleteCurrentNode = (): Result<Unit> =>
  se.modify<Context, CompileError>(s => ({ ...s, currentNode: undefined }));

const findIdentifierRecur = (name: Identifier, stack: Stack): Option<Identifier> =>
  pipe(
    readonlyRecord.lookup(name.name, stack.identifiers),
    option.orElse(() => (stack.parent ? findIdentifierRecur(name, stack.parent) : option.none)),
  );

const findIdentifier = (
  name: Identifier,
  stack: Stack,
): 'InThisStack' | 'InParentStacks' | 'None' =>
  pipe(
    readonlyRecord.lookup(name.name, stack.identifiers),
    option.match(
      () =>
        stack.parent
          ? pipe(
              findIdentifierRecur(name, stack.parent),
              option.match(
                () => 'None',
                () => 'InParentStacks',
              ),
            )
          : 'None',
      () => 'InThisStack',
    ),
  );

type HasAnnotation = ComputedNodeBody & Readonly<{ annotations: ReadonlyArray<NodeAnnotation> }>;
const hasAnnotation = (body: ComputedNodeBody): body is HasAnnotation =>
  (body as HasAnnotation).annotations != null;

const addIsResult = (node: ComputedNode): ComputedNode =>
  hasAnnotation(node.body)
    ? {
        ...node,
        body: identity<HasAnnotation>({
          ...node.body,
          annotations: pipe(
            node.body.annotations,
            readonlyArray.exists(_ => _.name.name === 'isResult'),
            _ =>
              _
                ? (node.body as HasAnnotation).annotations
                : identity<ReadonlyArray<NodeAnnotation>>([
                    ...(node.body as HasAnnotation).annotations,
                    identity<NodeAnnotation>({
                      type: 'NodeAnnotation',
                      name: {
                        type: 'Identifier',
                        annotations: [],
                        name: 'isResult',
                        context: node.body.context,
                      },
                      value: {
                        type: 'Boolean',
                        value: true,
                        context: node.body.context,
                      },
                      context: node.body.context,
                    }),
                  ]),
          ),
        }),
      }
    : node;

export const compileFromFile = async (path: string): Promise<Json> =>
  pipe(
    await fs.promises.readFile(path, 'utf-8'),
    compileFromString,
    either.match(
      e => Promise.reject(e),
      _ => Promise.resolve(_),
    ),
  );

export const compileFromString = (source: string): Either<CompileError | ParserError, Json> =>
  pipe(
    file,
    parser.run(stream.create(source)),
    either.flatMap(({ data }) => pipe(graphToJson(data), run)),
    either.map(([_]) => _.json),
  );

export const run = (self: Result): Either<CompileError, [CompileData, Context]> =>
  pipe(
    self({
      stack: newStack(),
      nodeIndex: 0,
    }),
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
            se.let_('node', ({ isLastNode }) =>
              isLastNode ? addIsResult(node_ as ComputedNode) : node_,
            ),
            // Create a node's name if it's not defined
            se.bind('name', ({ node }) =>
              node.name == null
                ? getAnnonName()
                : se.right<Context, CompileError, string>(node.name.name),
            ),
            // Convert the node to a JSON
            se.tap(({ node }) => updateCurrentNode(node)),
            se.bind('jsonNode', ({ node }) => nodeToJson(node)),
            se.tap(() => deleteCurrentNode()),
            se.map(({ index, json, captures, name, jsonNode }) => ({
              json: { ...json, ...jsonNode.nodes, [name]: jsonNode.json },
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

export const computedNodeBodyExprToJson = (
  expr: ComputedNodeBodyExpr,
): Result<CompileData<JsonObject>> => {
  switch (expr.type) {
    case 'IfThenElse':
      return ifThenElseToJson(expr);
    case 'ComputedNodeBodyParen':
      return computedNodeParenToJson(expr);
    case 'AgentDef':
      return agentDefToJson(expr);
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
      return agentCallToJson(expr);
    case 'String':
      return computedNodeStringToJson(expr);
    default:
      return se.left<Context, CompileError, CompileData<JsonObject>>({
        type: 'CompileError',
        items: [
          {
            message: `Unknown computed node expression type: ${expr.type}`,
            parserContext: expr.context,
          },
        ],
      });
  }
};

export const exprToJson = (expr: Expr): Result => {
  switch (expr.type) {
    case 'IfThenElse':
      return ifThenElseToJson(expr);
    case 'Paren':
      return parenToJson(expr);
    case 'ArrayAt':
      return arrayAtToJson(expr);
    case 'ObjectMember':
      return objectMemberToJson(expr);
    case 'AgentCall':
      return agentCallToJson(expr);
    case 'AgentDef':
      return agentDefToJson(expr);
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

export const annotationsToJson = (
  annotations: ReadonlyArray<NodeAnnotation>,
): Result<
  Readonly<{
    json: JsonObject;
    nodes: JsonObject;
  }>
> =>
  pipe(
    annotations,
    readonlyArray.reduce(
      se.right<
        Context,
        CompileError,
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
              se.get<Context, CompileError>(),
              se.flatMap(({ stack }) =>
                pipe(
                  value.captures,
                  readonlyRecord.reduce(string.Ord)(
                    identity<ReadonlyArray<CompileErrorItem>>([]),
                    (xs, value) =>
                      readonlyRecord.has(value.name, stack.identifiers)
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
                      ? se.right<Context, CompileError, Unit>(unit)
                      : se.left<Context, CompileError, Unit>(
                          identity<CompileError>({
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

/**
 * nestedGraph:
 *   isResult: true
 *   console:
 *     after: true
 *   agent: 'nestedAgent'
 *   inputs: { ...}
 *   graph: { ... }
 */
export const nestedGraphToJson = (graph: NestedGraph): Result<CompileData<JsonObject>> =>
  pipe(
    se.right<Context, CompileError, Unit>(unit),
    // Convert the annotations to the node's parameters
    se.bind('annotations', () => annotationsToJson(graph.annotations)),
    // Convert the nested graph to a JSON
    se.bind('jsonGraph', () => graphToJson(graph.graph)),
    // Find the identifiers to be captured from the parent stack
    // inputs: { name: ':name' }
    se.bind('inputsCaptures', ({ jsonGraph }) =>
      pipe(
        jsonGraph.captures,
        readonlyRecord.reduce(string.Ord)(
          se.right<Context, CompileError, Readonly<{ inputs: JsonObject; captures: Captures }>>({
            inputs: newJsonObject(),
            captures: newCapures(),
          }),
          (fobj, value) =>
            pipe(
              fobj,
              se.flatMap(({ inputs, captures }) =>
                pipe(
                  se.get<Context, CompileError>(),
                  se.flatMap(({ stack }) =>
                    pipe(
                      stack.identifiers,
                      readonlyRecord.lookup(value.name),
                      option.match(
                        // If the identifier is not found, tell the parent stack to capture it
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
    se.map(({ annotations, jsonGraph, inputsCaptures: { inputs, captures } }) => ({
      json: {
        ...annotations.json,
        agent: 'nestedAgent',
        inputs,
        graph: jsonGraph.json,
      },
      captures,
      nodes: annotations.nodes,
    })),
  );

export const ifThenElseToJson = (ifThenElse: IfThenElse): Result<CompileData<JsonObject>> =>
  pipe(
    se.right<Context, CompileError, Unit>(unit),
    se.bind('annotations', () => annotationsToJson(ifThenElse.annotations)),
    se.bind('if_', () =>
      exprToJson({
        type: 'AgentDef',
        annotations: [],
        body: ifThenElse.if.type === 'NestedGraph' ? ifThenElse.if.graph : ifThenElse.if,
        context: ifThenElse.if.context,
      }),
    ),
    se.bind('ifNode', () => getAnnonName()),
    se.bind('then_', () =>
      exprToJson({
        type: 'AgentDef',
        annotations: [],
        body: ifThenElse.then.type === 'NestedGraph' ? ifThenElse.then.graph : ifThenElse.then,
        context: ifThenElse.then.context,
      }),
    ),
    se.bind('thenNode', () => getAnnonName()),
    se.bind('else_', () =>
      exprToJson({
        type: 'AgentDef',
        annotations: [],
        body: ifThenElse.else.type === 'NestedGraph' ? ifThenElse.else.graph : ifThenElse.else,
        context: ifThenElse.else.context,
      }),
    ),
    se.bind('elseNode', () => getAnnonName()),
    se.map(({ annotations, if_, ifNode, then_, thenNode, else_, elseNode }) => ({
      nodes: {
        ...if_.nodes,
        ...then_.nodes,
        ...else_.nodes,
        [ifNode]: if_.json,
        [thenNode]: then_.json,
        [elseNode]: else_.json,
      },
      json: identity<JsonObject>({
        ...annotations.json,
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
    })),
  );

export const parenToJson = (paren: Paren): Result => exprToJson(paren.expr);

export const computedNodeParenToJson = (
  paren: ComputedNodeBodyParen,
): Result<CompileData<JsonObject>> =>
  pipe(
    result.Do,
    se.bind('annotations', () => annotationsToJson(paren.annotations)),
    se.bind('expr', () => computedNodeToJson(paren.expr)),
    se.map(({ annotations, expr }) => ({
      json: {
        ...annotations.json,
        ...expr.json,
      },
      captures: expr.captures,
      nodes: expr.nodes,
    })),
  );

export const agentCallToJson = (agentCall: AgentCall): Result<CompileData<JsonObject>> =>
  pipe(
    result.Do,
    se.bind('annotations', () => annotationsToJson(agentCall.annotations)),
    se.bind('agent', () =>
      agentCall.agent.type === 'Identifier'
        ? pipe(
            result.Do,
            se.bind('ctx', () => result.get()),
            se.let_('agent', () => agentCall.agent as Identifier),
            se.flatMap(({ ctx: { stack }, agent }) =>
              pipe(findIdentifier(agent, stack), _ =>
                _ === 'InThisStack' || _ === 'InParentStacks'
                  ? result.of<CompileData>({
                      json: `:${agent.name}`,
                      captures: {
                        [agent.name]: agent,
                      },
                      nodes: {},
                    })
                  : result.of({
                      json: agent.name,
                      captures: {},
                      nodes: {},
                    }),
              ),
            ),
          )
        : agentCall.agent.type === 'AgentCall'
          ? pipe(
              result.Do,
              se.bind('call', () => agentCallToJson(agentCall.agent as AgentCall)),
              se.bind('name', () => getAnnonName()),
              se.map(({ call, name }) => ({
                json: `:${name}`,
                captures: call.captures,
                nodes: {
                  ...call.nodes,
                  [name]: call.json,
                },
              })),
            )
          : exprToJson(agentCall.agent),
    ),
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
    se.flatMap(({ annotations, agent, args, nestedAgentCall }) =>
      nestedAgentCall
        ? pipe(
            getAnnonName(),
            se.map(agentName => ({
              json: {
                ...annotations.json,
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
                    ...annotations.json,
                    agent: agent.json,
                  }
                : {
                    ...annotations.json,
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

export const annotatedAgentCallToJson = (agentCall: AgentCall): Result =>
  pipe(
    result.Do,
    se.bind('annotations', () => annotationsToJson(agentCall.annotations)),
    se.bind('agentCall', () => agentCallToJson(agentCall)),
    se.map(({ annotations, agentCall }) =>
      identity<CompileData>({
        json: {
          ...annotations.json,
          ...agentCall.json,
        },
        captures: agentCall.captures,
        nodes: {
          ...annotations.nodes,
          ...agentCall.nodes,
        },
      }),
    ),
  );

export const agentDefToJson = (agentDef: AgentDef): Result<CompileData<JsonObject>> =>
  pipe(
    result.Do,
    se.bind('annotations', () => annotationsToJson(agentDef.annotations)),
    se.bind('graph', () =>
      graphToJson(
        agentDef.body.type === 'Graph'
          ? agentDef.body
          : {
              type: 'Graph',
              statements: [
                {
                  type: 'ComputedNode',
                  body: agentDef.body,
                  context: agentDef.body.context,
                },
              ],
              context: agentDef.body.context,
            },
        agentDef.args ? { agentArgs: [agentDef.args] } : undefined,
      ),
    ),
    se.let_('captures', ({ graph }) =>
      pipe(
        graph.captures,
        readonlyRecord.filter(value => value.name !== agentDef.args?.name),
      ),
    ),
    se.map(({ annotations, graph, captures }) => ({
      json: {
        ...annotations.json,
        agent: 'defAgent',
        inputs: {
          args: agentDef.args?.name,
          capture: pipe(
            captures,
            readonlyRecord.map(value => `:${value.name}`),
          ),
          return: [graph.lastNodeName],
        },
        graph: graph.json,
      },
      captures,
      nodes: graph.nodes,
    })),
  );

export const logicalToJson = (logical: Logical): Result<CompileData<JsonObject>> =>
  agentCallToJson({
    type: 'AgentCall',
    annotations: logical.annotations,
    agent: {
      type: 'Identifier',
      annotations: [],
      name: logical.operator === '&&' ? 'andAgent' : 'orAgent',
      context: logical.context,
    },
    args: {
      type: 'Object',
      value: [
        {
          key: {
            type: 'Identifier',
            annotations: [],
            name: 'left',
            context: logical.left.context,
          },
          value: logical.left,
        },
        {
          key: {
            type: 'Identifier',
            annotations: [],
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
    annotations: equality.annotations,
    agent: {
      type: 'Identifier',
      annotations: [],
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
            annotations: [],
            name: 'left',
            context: equality.left.context,
          },
          value: equality.left,
        },
        {
          key: {
            type: 'Identifier',
            annotations: [],
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
    annotations: relational.annotations,
    agent: {
      type: 'Identifier',
      annotations: [],
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
            annotations: [],
            name: 'left',
            context: relational.left.context,
          },
          value: relational.left,
        },
        {
          key: {
            type: 'Identifier',
            annotations: [],
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
    annotations: plusMinus.annotations,
    agent: {
      type: 'Identifier',
      annotations: [],
      name: plusMinus.operator === '+' ? 'plusAgent' : 'minusAgent',
      context: plusMinus.context,
    },
    args: {
      type: 'Object',
      value: [
        {
          key: {
            type: 'Identifier',
            annotations: [],
            name: 'left',
            context: plusMinus.left.context,
          },
          value: plusMinus.left,
        },
        {
          key: {
            type: 'Identifier',
            annotations: [],
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
    annotations: mulDivMod.annotations,
    agent: {
      type: 'Identifier',
      annotations: [],
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
            annotations: [],
            name: 'left',
            context: mulDivMod.left.context,
          },
          value: mulDivMod.left,
        },
        {
          key: {
            type: 'Identifier',
            annotations: [],
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
    annotations: power.annotations,
    agent: {
      type: 'Identifier',
      annotations: [],
      name: 'powAgent',
      context: power.context,
    },
    args: {
      type: 'Object',
      value: [
        {
          key: {
            type: 'Identifier',
            annotations: [],
            name: 'base',
            context: power.base.context,
          },
          value: power.base,
        },
        {
          key: {
            type: 'Identifier',
            annotations: [],
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
  agentCallToJson({
    type: 'AgentCall',
    annotations: arrayAt.annotations,
    agent: {
      type: 'Identifier',
      annotations: [],
      name: 'getArrayElementAgent',
      context: arrayAt.context,
    },
    args: {
      type: 'Object',
      value: [
        {
          key: {
            type: 'Identifier',
            annotations: [],
            name: 'array',
            context: arrayAt.array.context,
          },
          value: arrayAt.array,
        },
        {
          key: {
            type: 'Identifier',
            annotations: [],
            name: 'index',
            context: arrayAt.index.context,
          },
          value: arrayAt.index,
        },
      ],
      context: arrayAt.context,
    },
    context: arrayAt.context,
  });

export const objectMemberToJson = (objectMember: ObjectMember): Result<CompileData<JsonObject>> =>
  pipe(
    result.Do,
    se.bind('annotations', () => annotationsToJson(objectMember.annotations)),
    se.bind('object', () => exprToJson(objectMember.object)),
    se.map(({ annotations, object }) => ({
      json: {
        ...annotations.json,
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
    se.get<Context, CompileError>(),
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
    annotations: [],
    agent: {
      type: 'Identifier',
      annotations: [],
      name: 'concatStringAgent',
      context: string.context,
    },
    args: {
      type: 'Object',
      value: [
        {
          key: {
            type: 'Identifier',
            annotations: [],
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
          se.map(({ json, captures, nodes, value }) => ({
            json: [...json, value.json],
            captures: { ...captures, ...value.captures },
            nodes: { ...nodes, ...value.nodes },
          })),
        ),
    ),
  );

export const objectPairToJson = (pair: DSLObjectPair): Result<CompileData<JsonObject>> =>
  pipe(
    result.Do,
    se.bind('value', () => exprToJson(pair.value)),
    se.let_(
      'isRowString',
      () => pair.value.type === 'String' && pipe(toRawString(pair.value), option.isSome),
    ),
    se.flatMap(({ value, isRowString }) =>
      pair.value.type === 'Identifier' ||
      pair.value.type === 'Boolean' ||
      pair.value.type === 'Number' ||
      pair.value.type === 'Array' ||
      pair.value.type === 'Object' ||
      isRowString
        ? result.of({
            json: { [pair.key.name]: value.json },
            captures: value.captures,
            nodes: value.nodes,
          })
        : pipe(
            getAnnonName(),
            se.map(name => ({
              json: { [pair.key.name]: `:${name}` },
              captures: value.captures,
              nodes: {
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
      se.right<Context, CompileError, CompileData<JsonObject>>({
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
