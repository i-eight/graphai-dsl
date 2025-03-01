---
sidebar_position: 15
---

# GraphAI DSLを始める

## インストール

```
yarn add @graphai-dsl/cli
```

## 実行方法

```
yarn graphai-dsl run <source file>
```

## Hello World

`hello-world.graphai`:
```
version('0.6');

println('Hello World!');
```

実行:

```
yarn graphai-dsl run hello-world.graphai
```

出力結果:

```
Hello World!
```

## JSONを出力する

```
yarn graphai-dsl compile <source file>
```

## TypeScriptのライブラリとして使う

`hello-world.ts`:
```
import { GraphAI, GraphData } from 'graphai';
import { compiler, agents } from '@graphai-dsl/lib';
import { source } from '@graphai-dsl/lib';

const src = source.fromData(`
  @version('0.6');
  println('Hello World!');
`);

const json = compiler.compileFromStringOrThrow(src, agents);
new GraphAI(json as GraphData, agents).run();
```

実行:

```
yarn tsx hello-world.ts
```

出力結果:

```
Hello World!
```