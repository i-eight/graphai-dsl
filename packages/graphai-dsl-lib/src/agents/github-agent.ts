import { task } from 'fp-ts';
import { apply, pipe } from 'fp-ts/lib/function';
import { AgentFunction, AgentFunctionInfo } from 'graphai';
import { unit } from '../lib/unit';

type Issue = Readonly<{
  id: number;
  number: number;
  url: string;
  repository_url: string;
  title: string;
  body: string;
  state: string;
}>;

type GetGithubIssuesAgent = AgentFunction<
  object,
  ReadonlyArray<Issue>,
  Readonly<{
    owner: string;
    repo: string;
    accessToken: string;
  }>
>;

type CreateGithubIssueAgent = AgentFunction<
  object,
  Issue,
  Readonly<{
    owner: string;
    repo: string;
    accessToken: string;
    title: string;
    body?: string;
  }>
>;

type EditGithubIssueAgent = AgentFunction<
  object,
  Issue,
  Readonly<{
    owner: string;
    repo: string;
    accessToken: string;
    issueNumber: number;
    title?: string;
    body?: string;
  }>
>;

type CloseGithubIssueAgent = AgentFunction<
  object,
  Issue,
  Readonly<{
    owner: string;
    repo: string;
    accessToken: string;
    issueNumber: number;
  }>
>;

const getHeaders = (accessToken: string) => ({
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  Authorization: `Bearer ${accessToken}`,
  'User-Agent': 'graphai',
});

const issueType = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    number: { type: 'number' },
    url: { type: 'string' },
    repository_url: { type: 'string' },
    title: { type: 'string' },
    body: { type: 'string' },
    state: { type: 'string' },
  },
} as const;

const getGithubIssuesAgent: GetGithubIssuesAgent = ({
  namedInputs: { owner, repo, accessToken },
}) =>
  pipe(
    () =>
      fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
        headers: getHeaders(accessToken),
      }),
    task.flatMap(r => () => r.json()),
    task.map(_ => _ as ReadonlyArray<Issue>),
    apply(unit),
  );

export const getGithubIssuesAgentInfo: AgentFunctionInfo = {
  name: 'getGithubIssuesAgent',
  agent: getGithubIssuesAgent,
  mock: getGithubIssuesAgent,

  description: 'Get issues from Github repository',

  inputs: {
    type: 'object',
    properties: {
      owner: { type: 'string' },
      repo: { type: 'string' },
      accessToken: { type: 'string' },
    },
    required: ['owner', 'repo', 'accessToken'],
  },

  output: {
    type: 'array',
    items: issueType,
  },

  samples: [],
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};

const createGithubIssueAgent: CreateGithubIssueAgent = ({
  namedInputs: { owner, repo, accessToken, title, body },
}) =>
  pipe(
    () =>
      fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
        method: 'POST',
        headers: getHeaders(accessToken),
        body: JSON.stringify({ title, body }),
      }),
    task.flatMap(r => () => r.json()),
    task.map(_ => _ as Issue),
    apply(unit),
  );

export const createGithubIssueAgentInfo: AgentFunctionInfo = {
  name: 'createGithubIssueAgent',
  agent: createGithubIssueAgent,
  mock: createGithubIssueAgent,

  description: 'Create an issue in Github repository',

  inputs: {
    type: 'object',
    properties: {
      owner: { type: 'string' },
      repo: { type: 'string' },
      accessToken: { type: 'string' },
      title: { type: 'string' },
      body: { type: 'string' },
    },
    required: ['owner', 'repo', 'accessToken', 'title'],
  },

  output: issueType,

  samples: [],
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};

const editGithubIssueAgent: EditGithubIssueAgent = ({
  namedInputs: { owner, repo, accessToken, issueNumber, title, body },
}) =>
  pipe(
    () =>
      fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
        method: 'PATCH',
        headers: getHeaders(accessToken),
        body: JSON.stringify({ title, body }),
      }),
    task.flatMap(r => () => r.json()),
    task.map(_ => _ as Issue),
    apply(unit),
  );

export const editGithubIssueAgentInfo: AgentFunctionInfo = {
  name: 'editGithubIssueAgent',
  agent: editGithubIssueAgent,
  mock: editGithubIssueAgent,

  description: 'Edit an issue in Github repository',

  inputs: {
    type: 'object',
    properties: {
      owner: { type: 'string' },
      repo: { type: 'string' },
      accessToken: { type: 'string' },
      issueNumber: { type: 'number' },
      title: { type: 'string' },
      body: { type: 'string' },
    },
    required: ['owner', 'repo', 'accessToken', 'issueNumber'],
  },

  output: issueType,

  samples: [],
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};

const closeGithubIssueAgent: CloseGithubIssueAgent = ({
  namedInputs: { owner, repo, accessToken, issueNumber },
}) =>
  pipe(
    () =>
      fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
        method: 'PATCH',
        headers: getHeaders(accessToken),
        body: JSON.stringify({ state: 'closed' }),
      }),
    task.flatMap(r => () => r.json()),
    task.map(_ => _ as Issue),
    apply(unit),
  );

export const closeGithubIssueAgentInfo: AgentFunctionInfo = {
  name: 'closeGithubIssueAgent',
  agent: closeGithubIssueAgent,
  mock: closeGithubIssueAgent,

  description: 'Close an issue in Github repository',

  inputs: {
    type: 'object',
    properties: {
      owner: { type: 'string' },
      repo: { type: 'string' },
      accessToken: { type: 'string' },
      issueNumber: { type: 'number' },
    },
    required: ['owner', 'repo', 'accessToken', 'issueNumber'],
  },

  output: issueType,

  samples: [],
  category: ['general'],
  author: 'ai',
  repository: 'https://github.com/receptron/graphai/',
  license: 'MIT',
};
