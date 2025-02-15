# GraphAI DSL

This is a language for GraphAI, allowing for simpler descriptions than JSON or YAML.

For example, you can write as follows:

```
llm =
  @params({model: 'gpt-4o'})
  openAIAgent({prompt: "prompt: Explain ML's transformer in 100 words."});

println({message: llm.text});
```

This is converted into the following JSON:

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

The execution result is as follows:

```
A transformer is a type of machine learning model introduced in the paper "Attention is All You Need" by Vaswani et al. in 2017. It revolutionized natural language processing by using self-attention mechanisms to weigh the significance of different words in a sentence, enabling parallel processing of data. This architecture consists of an encoder and a decoder, each with layers of self-attention and feedforward neural networks. Unlike recurrent models, transformers handle entire sequences simultaneously, improving computational efficiency and performance. They are foundational in models like BERT and GPT, excelling in tasks like translation, summarization, and text generation.
```

## Installation

```
yarn add @i-eight/graphai-dsl-cli
```

## How to Execute

The following command converts the source file to JSON and executes it:

```
yarn graphai-dsl run <source file>
```

To output only the JSON, use the following command:

```
yarn graphai-dsl compile <source file>
```

## More Examples

https://github.com/i-eight/graphai-dsl/tree/main/packages/graphai-dsl-cli/examples