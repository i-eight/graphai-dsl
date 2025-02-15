# GraphAI DSL

GraphAI用の言語です。JSONやYAMLよりも簡単に記述できます。

例えば以下のように記述できます。

```
llm =
  @params({model: 'gpt-4o'})
  openAIAgent({prompt: "prompt: Explain ML's transformer in 100 words."});

println({message: llm.text});
```

これは以下のJSONに変換されます。

```
{
  "nodes": {
    "llm": {
      "params": {
        "model": "gpt-4o"
      },
      "agent": "openAIAgent",
      "inputs": {
        "prompt": "prompt: Explain ML's transformer in 100 words."
      }
    },
    "__anon1__": {
      "agent": "getObjectMemberAgent",
      "inputs": {
        "object": ":llm",
        "key": "text"
      }
    },
    "__anon0__": {
      "isResult": true,
      "agent": "println",
      "inputs": {
        "message": ":__anon1__"
      }
    }
  }
}
```

実行結果は以下です。

```
A transformer is a type of machine learning model introduced in the paper "Attention is All You Need" by Vaswani et al. in 2017. It revolutionized natural language processing by using self-attention mechanisms to weigh the significance of different words in a sentence, enabling parallel processing of data. This architecture consists of an encoder and a decoder, each with layers of self-attention and feedforward neural networks. Unlike recurrent models, transformers handle entire sequences simultaneously, improving computational efficiency and performance. They are foundational in models like BERT and GPT, excelling in tasks like translation, summarization, and text generation.
```

## 実行方法

以下はソースファイルをJSONに変換して実行します。

```
npx tsx src/index.ts run <source file>
```

JSONのみを出力する場合は以下のコマンドを使用してください。

```
npx tsx src/index.ts compile <source file>
```

CLIコマンドは今後用意する予定です。

## その他の例

- https://github.com/i-eight/graphai-dsl/blob/main/docs/spec.md
- https://github.com/i-eight/graphai-dsl/tree/main/examples
- https://github.com/i-eight/graphai-dsl/blob/main/tests/compiler.spec.ts
