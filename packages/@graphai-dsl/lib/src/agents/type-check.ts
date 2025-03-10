import { AgentFunctionContext, AgentFunctionInfo } from 'graphai';

type AFC<Args> = AgentFunctionContext<object, Args>;
type AFR<Return> = Promise<Return>;

//----------------------------------------------------------------------
type IsBooleanArg = AFC<unknown>;
type IsBooleanReturn = AFR<boolean>;

const isBoolean = async ({ namedInputs: value }: IsBooleanArg): IsBooleanReturn =>
  typeof value === 'boolean';

export const isBooleanAgentInfo: AgentFunctionInfo = {
  name: 'isBooleanAgent',
  agent: isBoolean,
  mock: isBoolean,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};

//----------------------------------------------------------------------
type IsNumberArg = AFC<unknown>;
type IsNumberReturn = AFR<boolean>;

const isNumber = async ({ namedInputs: value }: IsNumberArg): IsNumberReturn =>
  typeof value === 'number';

export const isNumberAgentInfo: AgentFunctionInfo = {
  name: 'isNumberAgent',
  agent: isNumber,
  mock: isNumber,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};

//----------------------------------------------------------------------
type IsStringArg = AFC<unknown>;
type IsStringReturn = AFR<boolean>;

const isString = async ({ namedInputs: value }: IsStringArg): IsStringReturn =>
  typeof value === 'string';

export const isStringAgentInfo: AgentFunctionInfo = {
  name: 'isStringAgent',
  agent: isString,
  mock: isString,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};

//----------------------------------------------------------------------
type IsArrayArg = AFC<unknown>;
type IsArrayReturn = AFR<boolean>;

const isArray = async ({ namedInputs: value }: IsArrayArg): IsArrayReturn => Array.isArray(value);

export const isArrayAgentInfo: AgentFunctionInfo = {
  name: 'isArrayAgent',
  agent: isArray,
  mock: isArray,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};

//----------------------------------------------------------------------
type IsObjectArg = AFC<unknown>;
type IsObjectReturn = AFR<boolean>;

const isObject = async ({ namedInputs: value }: IsObjectArg): IsObjectReturn =>
  typeof value === 'object' && !Array.isArray(value);

export const isObjectAgentInfo: AgentFunctionInfo = {
  name: 'isObjectAgent',
  agent: isObject,
  mock: isObject,

  samples: [],
  description: 'this is agent',
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
