import { buildAPI } from "./common";

(async () => {
  const api = buildAPI({
    apiKey: "NOT_NEED",
    debug: true,
    debug_mock: true,
  });
  const messages = [
    {
      role: "system" as const,
      content: "You are a helpful assistant.",
    },
    {
      role: "user" as const,
      content: "hi, what date is now?",
    },
  ];
  const resp = await api.createChatCompletions(messages);
  console.log(`[resp]`, resp);
  {
    const count = await api.estimateTokenUsage(messages);
    console.log(`[count]`, count);
  }
  {
    const count = await api.estimateTokenUsage([messages[0]]);
    console.log(`[count]`, count);
  }
  {
    const count = await api.estimateTokenUsage([messages[1]]);
    const text = await api.normalizeMessages([messages[1]]);
    console.log(`[count]`, count, { text, arr: text.split("") });
  }
  console.log(await api.normalizeMessages(messages));
})();

export default {};
