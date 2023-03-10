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
  const models = await api.listModels();
  for (const model of models) {
    const text = `[${model.id}|${model.created}]${JSON.stringify(
      model.permission[0]
    )}`;
    console.log(text);
  }
  console.log(`you has permission on ${models.length} models.`);
})();

export default {};
