import { describe, expect, test } from "@jest/globals";
import { ChatGPTAPI } from "./chatgpt-api";

const createAPI = () =>
  new ChatGPTAPI({
    apiKey: "TEST_NOT_NEEDED",
    debug_mock: true,
  });

describe("ChatGPTAPI estimate token usage test", () => {
  test("token calculation should be the same as the openai official example", async () => {
    const tokenizer_examples = `
Many words map to one token, but some don't: indivisible.

Unicode characters like emojis may be split into many tokens containing the underlying bytes: 🤚🏾

Sequences of characters commonly found next to each other may be grouped together: 1234567890
`.trim();
    const example_number = 64;
    const example_token_ids = [
      7085, 2456, 3975, 284, 530, 11241, 11, 475, 617, 836, 470, 25, 773, 452,
      12843, 13, 198, 198, 3118, 291, 1098, 3435, 588, 795, 13210, 271, 743,
      307, 6626, 656, 867, 16326, 7268, 262, 10238, 9881, 25, 12520, 97, 248,
      8582, 237, 122, 198, 198, 44015, 3007, 286, 3435, 8811, 1043, 1306, 284,
      1123, 584, 743, 307, 32824, 1978, 25, 17031, 2231, 30924, 3829,
    ];

    const api = createAPI();
    const api_tokenize_tokens = await api._tokenize(tokenizer_examples);
    expect(api_tokenize_tokens.length).toBe(example_number);
    expect(api_tokenize_tokens).toBe(example_token_ids);
  });

  test("Message token number in Conversation estimation should be the same as official response, single message", async () => {
    const api = createAPI();
    const messages = [
      {
        role: "user" as const,
        content: "hi, what date in today?",
      },
    ];
    const prompt_tokens = 14; // from official response

    const estimateCount = api.estimateTokenUsage(messages);
    expect(estimateCount).toEqual(prompt_tokens);
  });

  test("Message token number in Conversation estimation should be the same as official response, multiple rounds messages", async () => {
    const api = createAPI();
    const messages = [
      {
        role: "system" as const,
        content: "You are a helpful assistant.",
      },
      {
        role: "user" as const,
        content: "hi, what date in today?",
      },
    ];
    const prompt_tokens = 25; // from official response

    const estimateCount = api.estimateTokenUsage(messages);
    expect(estimateCount).toEqual(prompt_tokens);
  });
});
