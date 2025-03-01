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

```
yarn graphai-dsl run hello-world.graphai
```

```
Hello World!
```

## JSONを出力する

```
yarn graphai-dsl compile <source file>
```

## TypeScriptのライブラリとして使う

T.B.D.