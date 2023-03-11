import { buildAPI } from "./common";

(async () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("process.env.OPENAI_API_KEY is require, but undefined");
  }
  const api = buildAPI({
    apiKey: process.env.OPENAI_API_KEY,
    debug: true,
    debug_mock: true,
  });

  const resp = await api.createChatCompletions([
    {
      role: "system",
      content: "You are a helpful assistant.",
    },
    {
      role: "user",
      content: "hi, what date in today?",
    },
  ]);
  console.log(resp);
})();

export default {};
