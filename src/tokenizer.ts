import GPT3Tokenizer from "gpt3-tokenizer";

// this to fix esm loader
const tokenizer = new (((GPT3Tokenizer as any).default ||
  GPT3Tokenizer) as typeof GPT3Tokenizer)({ type: "gpt3" });

export const encode = (text: string) => tokenizer.encode(text).bpe;
