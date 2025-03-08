import { ParserRange as Context } from './parser-combinator';

export type File = Readonly<{
  type: 'File';
  path: string;
  imports?: ReadonlyArray<Import | NativeImport>;
  graph: Graph;
  context: Context;
}>;

export type Graph = Readonly<{
  type: 'Graph';
  version?: string;
  statements: Statements;
  context: Context;
}>;

export type Import = Readonly<{
  type: 'Import';
  path: string;
  as?: Identifier;
  context: Context;
}>;

export type NativeImport = Readonly<{
  type: 'NativeImport';
  path: string;
  as: Identifier;
  context: Context;
}>;

export type Statements = ReadonlyArray<Node>;

export type NestedGraph = Readonly<{
  type: 'NestedGraph';
  graph: Graph;
  context: Context;
}>;

export type Node = StaticNode | ComputedNode;

export type Modifier = {
  type: 'Modifier';
  value: 'public' | 'private';
  context: Context;
};

export type StaticNode = Readonly<{
  type: 'StaticNode';
  modifiers: ReadonlyArray<Modifier>;
  name: Identifier;
  value: Expr;
  context: Context;
}>;

export type ComputedNodeBody = Expr;

export type ComputedNode = Readonly<{
  type: 'ComputedNode';
  modifiers: ReadonlyArray<Modifier>;
  name?: Identifier;
  body: ComputedNodeBody;
  context: Context;
}>;

export type Expr =
  | IfThenElse
  | Paren
  | NestedGraph
  | Identifier
  | Literal
  | ArrayAt
  | ObjectMember
  | AgentCall
  | AgentDef
  | BinaryTerm;

export type IfThenElse = Readonly<{
  type: 'IfThenElse';
  if: ComputedNodeBody;
  then: ComputedNodeBody;
  else: ComputedNodeBody;
  context: Context;
}>;

export type Paren = Readonly<{
  type: 'Paren';
  expr: Expr;
  context: Context;
}>;

export type Identifier = Readonly<{
  type: 'Identifier';
  name: string;
  context: Context;
}>;

export type Literal =
  | DSLNumber
  | RawString
  | DSLString
  | DSLBoolean
  | DSLArray
  | DSLObject
  | DSLNull;

export type DSLNumber = Readonly<{
  type: 'Number';
  value: number;
  context: Context;
}>;

export type RawString = Readonly<{
  type: 'RawString';
  value: string;
  context: Context;
}>;

export type DSLString = Readonly<{
  type: 'String';
  value: ReadonlyArray<string | Expr>;
  context: Context;
}>;

export type DSLBoolean = Readonly<{
  type: 'Boolean';
  value: boolean;
  context: Context;
}>;

export type DSLArray = Readonly<{
  type: 'Array';
  value: ReadonlyArray<Expr>;
  context: Context;
}>;

export type DSLObjectPair = Readonly<{
  key: Identifier;
  value: Expr;
}>;

export type DSLObject = Readonly<{
  type: 'Object';
  value: ReadonlyArray<DSLObjectPair>;
  context: Context;
}>;

export type DSLNull = Readonly<{
  type: 'Null';
  context: Context;
}>;

export type Destructuring =
  | DSLNumber
  | DSLString
  | DSLBoolean
  | DSLNull
  | Identifier
  | ArrayDestructuring
  | ObjectDestructuring;

export type ArrayDestructuring = Readonly<{
  type: 'ArrayDestructuring';
  value: ReadonlyArray<Destructuring>;
  rest?: Identifier;
  context: Context;
}>;

export type ObjectPairDestructuring = Readonly<{
  type: 'ObjectPairDestructuring';
  key: Identifier;
  value: Destructuring;
}>;

export type ObjectDestructuring = Readonly<{
  type: 'ObjectDestructuring';
  value: ReadonlyArray<Identifier | ObjectPairDestructuring>;
  rest?: Identifier;
  context: Context;
}>;

export type AgentContext = Readonly<{
  type: 'AgentContext';
  name: Identifier;
  value: Expr;
  context: Context;
}>;

export type AgentDef = Readonly<{
  type: 'AgentDef';
  args?: Identifier | Destructuring;
  body: Expr | Graph;
  context: Context;
}>;

export type Term =
  | DSLNumber
  | DSLString
  | DSLBoolean
  | DSLArray
  | DSLObject
  | DSLNull
  | Paren
  | NestedGraph
  | Identifier;

export type Arrayable = DSLArray | Paren | Identifier;
export type ArrayAt = Readonly<{
  type: 'ArrayAt';
  array: Arrayable | Call;
  index: Expr;
  context: Context;
}>;

export type Objectable = DSLObject | Paren | Identifier;
export type ObjectMember = Readonly<{
  type: 'ObjectMember';
  object: Objectable | Call;
  key: Identifier;
  context: Context;
}>;

export type Agentable = Paren | Identifier;
export type AgentCall = Readonly<{
  type: 'AgentCall';
  agentContext: ReadonlyArray<AgentContext>;
  agent: Agentable | Call;
  args?: Expr;
  context: Context;
}>;

export type Callable = Arrayable | Objectable | Agentable;
export type Call = ArrayAt | ObjectMember | AgentCall;

export type TermPower = DSLNumber | Identifier | Paren | Call;

export type Power = Readonly<{
  type: 'Power';
  base: TermPower | Power;
  exponent: TermPower;
  context: Context;
}>;

export type TermMulDivMod = TermPower | Power;

export type MulDivMod = Readonly<{
  type: 'MulDivMod';
  left: TermMulDivMod | MulDivMod;
  operator: '*' | '/' | '%';
  right: TermMulDivMod;
  context: Context;
}>;

export type TermPlusMinus = TermMulDivMod | MulDivMod;

export type PlusMinus = Readonly<{
  type: 'PlusMinus';
  left: TermPlusMinus | PlusMinus;
  operator: '+' | '-';
  right: TermPlusMinus;
  context: Context;
}>;

export type TermRelational = TermPlusMinus | PlusMinus | DSLString;

export type Relational = Readonly<{
  type: 'Relational';
  left: TermRelational | Relational;
  operator: '<' | '<=' | '>' | '>=';
  right: TermRelational;
  context: Context;
}>;

export type TermEquality =
  | TermRelational
  | Relational
  | DSLBoolean
  | DSLNull
  | DSLArray
  | DSLObject;

export type Equality = Readonly<{
  type: 'Equality';
  left: TermEquality | Equality;
  operator: '==' | '!=';
  right: TermEquality;
  context: Context;
}>;

export type TermLogical = TermEquality | Equality;

export type Logical = Readonly<{
  type: 'Logical';
  left: TermLogical | Logical;
  operator: '&&' | '||';
  right: TermLogical;
  context: Context;
}>;

export type TermPipeline = TermLogical | Logical | IfThenElse | AgentDef;

export type Pipeline = Readonly<{
  type: 'Pipeline';
  left: TermPipeline | Pipeline;
  operator: '|>' | '-->' | '>>' | '>>=' | '>>-' | '->>' | ':>';
  right: TermPipeline;
  context: Context;
}>;

export type BinaryTerm = TermPipeline | Pipeline;

export type BlockComment = Readonly<{
  type: 'BlockComment';
  value: string;
  context: Context;
}>;

export type LineComment = Readonly<{
  type: 'LineComment';
  value: string;
  context: Context;
}>;
