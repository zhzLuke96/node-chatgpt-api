import pTimeout from "p-timeout";
import * as types from "./types";
import { fetchSSE } from "./fetch/fetch-sse";
import { NormalizeMessageFunction } from "./types";

import * as openai from "./openai.types";

import { encode as gpt3encoder } from "gpt-3-encoder";

type ChatGPTCallResult = openai.ChatCompletionResponseMessage & {
  _response?: openai.CreateChatCompletionResponse;
};

export class ChatGPTAPI {
  protected _apiKey: string;
  protected _apiBaseUrl: string;
  protected _debug: boolean;
  protected _debug_mock: boolean;

  protected _maxModelTokens: number;
  protected _maxResponseTokens: number;
  protected _minResponseTokens: number;
  protected _completionParams: Omit<
    openai.CreateChatCompletionRequest,
    "messages" | "n"
  >;

  protected _fetch: types.FetchFn;
  protected _normalizeMessage: NormalizeMessageFunction;
  _tokenize: types.Tokenizer;

  /**
   * Creates a new client wrapper around OpenAI's chat completion API, mimicing the official ChatGPT webapp's functionality as closely as possible.
   *
   * @param opts.apiKey - OpenAI API key (required).
   * @param opts.apiBaseUrl - Optional override for the OpenAI API base URL.
   * @param opts.debug - Optional enables logging debugging info to stdout.
   * @param opts.completionParams - Param overrides to send to the [OpenAI chat completion API](https://platform.openai.com/docs/api-reference/chat/create). Options like `temperature` and `presence_penalty` can be tweaked to change the personality of the assistant.
   * @param opts.fetch - Optional override for the `fetch` implementation to use. Defaults to the global `fetch` function.
   * @param opts.normalizeMessage - Optional function to normalize a message and calculate the final token usage. If not provided, the default implementation will concatenate message.role and message.content, and return the length of the resulting string as the token usage. The default message format is role: ${message.role}\ncontent: ${message.content}.
   * @param opts.tokenize - Optional function to converts input text into numerical tokens that are used by OpenAI's chat completion API to generate responses. default use "gpt-3-encoder"
   */
  constructor(opts: types.ChatGPTAPIOptions) {
    const {
      apiKey,
      apiBaseUrl = "https://api.openai.com",
      debug = false,
      debug_mock = false,
      completionParams,
      // 4096 - 6 => Keep 6 tokens in case the token is estimated incorrectly
      maxModelTokens = 4090,
      maxResponseTokens = 1024,
      minResponseTokens = 4,
      fetch = global.fetch,
      tokenize = gpt3encoder,
      normalizeMessage,
    } = opts;

    this._apiKey = apiKey;
    this._apiBaseUrl = apiBaseUrl;
    this._debug = !!debug;
    this._debug_mock = !!debug_mock;
    this._fetch = fetch;

    this._completionParams = {
      model: types.EModelId.turbo_0301,
      temperature: 0.8,
      top_p: 1.0,
      presence_penalty: 1.0,
      ...completionParams,
    };

    this._maxModelTokens = maxModelTokens;
    this._maxResponseTokens = maxResponseTokens;
    this._minResponseTokens = minResponseTokens;
    this._tokenize = tokenize ?? gpt3encoder;

    this._normalizeMessage = normalizeMessage ?? this._defaultNormalizeMessage;

    if (!this._apiKey) {
      throw new Error("OpenAI missing required apiKey");
    }

    if (!this._fetch) {
      throw new Error("Invalid environment; fetch is not defined");
    }

    if (typeof this._fetch !== "function") {
      throw new Error('Invalid "fetch" is not a function');
    }
  }

  /**
   * This function is used to query the list of OpenAI models, primarily to check if the current API key being used is valid.
   * @param organization - Optional parameter representing the name of the organization to query. Defaults to "" which indicates all organizations' models should be queried.
   */
  async listModels(organization = "") {
    const url = `${this._apiBaseUrl}/v1/models`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this._apiKey}`,
      ...(organization ? { "OpenAI-Organization": organization } : {}),
    };
    const res = await this._fetch(url, { headers });

    if (!res.ok) {
      const reason = await res.text();
      const msg = `OpenAI error ${res.status || res.statusText}: ${reason}`;
      const error = new types.ChatGPTError(msg, { cause: res });
      error.statusCode = res.status;
      error.statusText = res.statusText;
      throw error;
    }
    const responseData: openai.AuthModelsQueryResponse = await res.json();
    return responseData.data;
  }

  /**
   * Sends a request to the OpenAI chat completions endpoint, waits for the response
   * to resolve, and returns the response.
   *
   * If you want your response to have historical context, you must provide a valid `parentMessageId`.
   *
   * If you want to receive a stream of partial responses, use `opts.onProgress`.
   *
   * Set `debug: true` in the `ChatGPTAPI` constructor to log more info on the full prompt sent to the OpenAI chat completions API. You can override the `systemMessage` in `opts` to customize the assistant's instructions.
   *
   * @param messages - The prompt message to send
   * @param opts.timeoutMs - Optional timeout in milliseconds (defaults to no timeout)
   * @param opts.onProgress - Optional callback which will be invoked every time the partial response is updated
   * @param opts.abortSignal - Optional callback used to abort the underlying `fetch` call using an [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
   * @param opts.maxResponseTokens - Optional maximum number of tokens that can be returned in a single response
   *
   * @returns The response from ChatGPT
   */
  async createChatCompletions(
    messages: openai.ChatCompletionRequestMessage[],
    opts: types.SendMessageOptions = {}
  ): Promise<ChatGPTCallResult> {
    if (messages.length === 0) {
      throw new types.ChatGPTError("[] is too short - 'messages'");
    }

    const { timeoutMs, onProgress, completionParams } = opts;
    const byStreamAPICall = typeof onProgress === "function";

    let { abortSignal } = opts;

    let abortController: AbortController | null = null;
    if (timeoutMs && !abortSignal) {
      abortController = new AbortController();
      abortSignal = abortController.signal;
    }
    const limitMaxResponseTokens =
      opts.maxResponseTokens || this._maxResponseTokens;
    const limitMinResponseTokens =
      opts.minResponseTokens || this._minResponseTokens;

    const {
      messages: normalizeMessages,
      nextResponseTokens,
      tokenCount,
    } = await this.autoscalingMessages(
      messages,
      this._maxModelTokens,
      limitMinResponseTokens
    );

    const url = `${this._apiBaseUrl}/v1/chat/completions`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this._apiKey}`,
    };
    const body = {
      max_tokens: Math.max(
        1,
        Math.min(nextResponseTokens, limitMaxResponseTokens)
      ),
      ...this._completionParams,
      ...completionParams,
      messages: normalizeMessages,
      stream: byStreamAPICall,
    };
    if (this._debug) {
      console.log(`sendMessage (${tokenCount} tokens)`, body);
    }
    const requestInit = {
      headers,
      body: JSON.stringify(body),
      signal: abortSignal,
    };

    const apiFetcher = (() => {
      if (this._debug_mock) {
        return this.fetchChatCompletionsMocked;
      }
      if (byStreamAPICall) {
        return this.fetchChatCompletionsSSE;
      } else {
        return this.fetchChatCompletions;
      }
    })();
    const responseP = apiFetcher.bind(this)(url, requestInit, opts);

    if (timeoutMs) {
      if (abortController) {
        // This will be called when a timeout occurs in order for us to forcibly
        // ensure that the underlying HTTP request is aborted.
        (responseP as any).cancel = () => {
          abortController?.abort();
        };
      }

      return pTimeout(responseP, {
        milliseconds: timeoutMs,
        message: "OpenAI timed out waiting for response",
      });
    } else {
      return responseP;
    }
  }

  private async fetchChatCompletionsMocked(
    url: string,
    requestInit: NonNullable<Parameters<typeof global.fetch>[1]>,
    opt: types.SendMessageOptions
  ): Promise<ChatGPTCallResult> {
    const result: ChatGPTCallResult = {
      role: "assistant",
      content:
        Math.random() > 0.5
          ? "I agree"
          : "Please don't expect too much from me, I'm just an AI langue model",
    };
    return result;
  }

  private async fetchChatCompletionsSSE(
    url: string,
    requestInit: NonNullable<Parameters<typeof global.fetch>[1]>,
    opt: types.SendMessageOptions
  ) {
    const { onProgress } = opt;
    const result: ChatGPTCallResult = {
      role: "assistant",
      content: "",
    };
    return new Promise<ChatGPTCallResult>(async (resolve, reject) => {
      await fetchSSE(
        url,
        {
          ...(requestInit || {}),
          method: "POST",
          onMessage: (data: string) => {
            if (data === "[DONE]") {
              result.content = result.content.trim();
              return resolve(result);
            }
            try {
              const response: openai.CreateChatCompletionDeltaResponse =
                JSON.parse(data);

              if (response?.choices?.length) {
                const delta = response.choices[0].delta;
                if (delta?.content) {
                  result.content += delta.content;

                  if (delta.role) {
                    result.role = delta.role;
                  }

                  onProgress?.(result);
                }
              }
            } catch (err) {
              console.warn("OpenAI stream SEE event unexpected error", err);
              return reject(err);
            }
          },
        } as any,
        this._fetch
      );
    });
  }

  private async fetchChatCompletions(
    url: string,
    requestInit: NonNullable<Parameters<typeof global.fetch>[1]>,
    opt: types.SendMessageOptions
  ) {
    const result: ChatGPTCallResult = {
      role: "assistant",
      content: "",
    };

    const res = await this._fetch(url, {
      ...(requestInit || {}),
      method: "POST",
    });

    if (!res.ok) {
      const reason = await res.text();
      const msg = `OpenAI error ${res.status || res.statusText}: ${reason}`;
      const error = new types.ChatGPTError(msg, { cause: res });
      error.statusCode = res.status;
      error.statusText = res.statusText;
      throw error;
    }

    const response: openai.CreateChatCompletionResponse = await res.json();
    if (this._debug) {
      console.log(`[openai.CreateChatCompletionResponse]${response}`);
    }

    if (response?.choices?.[0].message) {
      const message = response.choices[0].message;
      result.content = message.content;
      if (message.role) {
        result.role = message.role;
      }
    } else {
      const res = response as any;
      throw new Error(
        `OpenAI error: ${res?.detail?.message || res?.detail || "unknown"}`
      );
    }

    result._response = response;
    return result;
  }

  /**
   * Helper method for organizing and filtering chat messages before sending them to the OpenAI API.
   * @param messages - An array of ChatCompletionRequestMessage objects representing the messages to be sent to the OpenAI API.
   * @param modelMaxTokens - The maximum number of tokens the OpenAI API model can receive.
   * @param responseMinTokens - The minimum number of tokens the API response should contain.
   * @returns An object containing relevant information about the processed chat messages, including the token count, required number of tokens for the next response, and the messages themselves.
   */
  async autoscalingMessages(
    messages: openai.ChatCompletionRequestMessage[],
    // 模型能接收的最大tokens数
    modelMaxTokens: number,
    // 调用者要求的最下回复tokens数
    responseMinTokens = 4
  ) {
    let tokenCount = await this.estimateTokenUsage(messages);
    let nextResponseMaxTokens = modelMaxTokens - tokenCount;

    const messageStatuses = messages.map((message) => ({
      message,
      discard: false,
      locked: false,
      tokenNum: 0,
    }));

    {
      // 锁住每种role最近的一段message
      const counter = {} as any;
      for (let index = messageStatuses.length - 1; index >= 0; index--) {
        const status = messageStatuses[index];
        if (counter[status.message.role]) {
          continue;
        } else {
          status.discard = false;
          status.locked = true;
          counter[status.message.role] = true;
        }
      }
    }

    {
      // 根据tokens要求屏蔽部分token
      let tmpTokenCount = 0;
      for (let index = 0; index < messageStatuses.length; index++) {
        const status = messageStatuses[index];

        const tokenNum = await this.estimateTokenUsage([status.message]);
        status.tokenNum = tokenNum;

        if (status.locked) {
          tmpTokenCount += tokenNum;
          continue;
        }
        if (tmpTokenCount > nextResponseMaxTokens) {
          status.discard = true;
          continue;
        }
        const nextCount = tokenNum + tmpTokenCount;
        if (nextCount > nextResponseMaxTokens) {
          status.discard = true;
        } else {
          tmpTokenCount = nextCount;
        }
      }
    }

    let currentTokenCount = 0;
    let nextResponseTokens = 0;

    const updateTokenNum = async () => {
      const pick_messages = messageStatuses.filter((x) => !x.discard);
      currentTokenCount = await this.estimateTokenUsage(
        pick_messages.map((x) => x.message)
      );
      nextResponseTokens = modelMaxTokens - currentTokenCount;
    };
    await updateTokenNum();

    while (nextResponseTokens < responseMinTokens) {
      const userUnlockedMessage = messageStatuses.find(
        (x) =>
          x.message.role === openai.ChatCompletionRequestMessageRoleEnum.User &&
          !x.locked &&
          !x.discard
      );
      if (userUnlockedMessage) {
        userUnlockedMessage.discard = true;
        await updateTokenNum();
        continue;
      }
      const assistantUnlockedMessage = messageStatuses.find(
        (x) =>
          x.message.role ===
            openai.ChatCompletionRequestMessageRoleEnum.Assistant &&
          !x.locked &&
          !x.discard
      );
      if (assistantUnlockedMessage) {
        assistantUnlockedMessage.discard = true;
        await updateTokenNum();
        continue;
      }
      break;
    }

    return {
      messageStatuses,
      tokenCount: currentTokenCount,
      nextResponseTokens: nextResponseTokens,
      messages: messageStatuses
        .filter((status) => !status.discard)
        .map((status) => status.message),
      excessMessages: messageStatuses
        .filter((status) => status.discard)
        .map((status) => status.message),
    };
  }

  get apiKey(): string {
    return this._apiKey;
  }

  set apiKey(apiKey: string) {
    this._apiKey = apiKey;
  }

  /**
   * Method for normalizing an array of chat messages by applying a normalization function and joining them together with a specified separator.
   * @param messages - An array of ChatCompletionRequestMessage objects to be normalized.
   * @param normalizeFn - An optional function to normalize each individual message. Defaults to the default normalization function.
   * @param separator - An optional separator object with prefix, suffix, and infix properties to use for joining the normalized messages. Defaults to a separator object with prefix "$\n", suffix "\n$\n", and infix "\n$\n".
   * @returns A string representing the normalized chat messages with the specified separator.
   */
  async normalizeMessages(
    messages: openai.ChatCompletionRequestMessage[],
    normalizeFn = this._defaultNormalizeMessage,
    separator = {
      prefix: "$\n",
      suffix: "\n$\n",
      infix: "\n$\n",
    }
  ) {
    const normalizedMessages = await Promise.all(messages.map(normalizeFn));
    const estimateContent =
      separator.prefix +
      normalizedMessages.join(separator.infix) +
      separator.suffix;
    return estimateContent;
  }

  /**
   * Method for estimating the token usage of an array of chat messages by normalizing them and counting the tokens in the resulting string.
   * @param messages - An array of ChatCompletionRequestMessage objects to be analyzed.
   * @param normalizeFn - An optional function to normalize each individual message. Defaults to the default normalization function.
   * @param separator - An optional separator object with prefix, suffix, and infix properties to use for joining the normalized messages. Defaults to a separator object with prefix "$\n", suffix "\n$\n", and infix "\n$\n".
   * @returns A Promise resolving to a number representing the estimated token usage of the chat messages.
   */
  async estimateTokenUsage(
    messages: openai.ChatCompletionRequestMessage[],
    normalizeFn = this._defaultNormalizeMessage,
    separator = {
      prefix: "$\n",
      suffix: "\n$\n",
      infix: "\n$\n",
    }
  ) {
    const estimateContent = await this.normalizeMessages(
      messages,
      normalizeFn,
      separator
    );
    return this._getTokenCount(estimateContent);
  }

  protected async _getTokenCount(text: string) {
    const tokens = await this._tokenize(text);
    return tokens.length;
  }

  protected async _defaultNormalizeMessage(
    message: openai.ChatCompletionRequestMessage,
    index: number,
    messages: openai.ChatCompletionRequestMessage[]
  ) {
    return `${message.role}\n${message.content}`;
  }
}
