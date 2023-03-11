import * as openai from "./openai.types";

export enum EModelId {
  "turbo" = "gpt-3.5-turbo",
  "turbo_0301" = "gpt-3.5-turbo-0301",
}

export type ModelId = "gpt-3.5-turbo" | "gpt-3.5-turbo-0301";

export type NormalizeMessageFunction = (
  message: openai.ChatCompletionRequestMessage,
  index: number,
  messages: openai.ChatCompletionRequestMessage[]
) => string | Promise<string>;

export type FetchFn = typeof globalThis.fetch;

export type ChatGPTAPIOptions = {
  apiKey: string;

  /** @defaultValue `'https://api.openai.com'` **/
  apiBaseUrl?: string;

  /** @defaultValue `false` **/
  debug?: boolean;

  /**
   * Does not request api, for testing
   *
   * @defaultValue `false`
   * **/
  debug_mock?: boolean;

  completionParams?: Partial<
    Omit<openai.CreateChatCompletionRequest, "messages" | "n">
  >;

  systemMessage?: string;

  /** @defaultValue `4090` **/
  maxModelTokens?: number;

  /** @defaultValue `1024` **/
  maxResponseTokens?: number;

  /** @defaultValue `4` **/
  minResponseTokens?: number;

  fetch?: FetchFn;

  normalizeMessage?: NormalizeMessageFunction;

  tokenize?: Tokenizer;
};

export type SendMessageOptions = {
  /** The name of a user in a multi-user chat. */
  name?: string;
  timeoutMs?: number;
  onProgress?: (partialResponse: openai.ChatCompletionRequestMessage) => void;
  abortSignal?: AbortSignal;
  completionParams?: Partial<
    Omit<openai.CreateChatCompletionRequest, "messages" | "n">
  >;
  /** @defaultValue `1024` **/
  maxResponseTokens?: number;
  /** @defaultValue `4` **/
  minResponseTokens?: number;
};

export class ChatGPTError extends Error {
  statusCode?: number;
  statusText?: string;
  isFinal?: boolean;
  accountId?: string;
}

type NumberArray =
  | number[]
  | Uint32Array
  | Uint8Array
  | Uint16Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Float32Array
  | Float64Array;
export type Tokenizer = (input: string) => NumberArray | Promise<NumberArray>;
