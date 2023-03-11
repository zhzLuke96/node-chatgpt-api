# chatgpt-api
ChatGPT API

> fork from https://github.com/transitive-bullshit/chatgpt-api

- only support official API
- without conversation management
- same as usage calculation from OpenAI-official
- autoscaling messages

# examples
```js
import { ChatGPTAPI } from '@llm-utils/chatgpt-api';
import nodeFetch from "node-fetch";
const main = async () => {
    const api = new ChatGPTAPI({
        apiKey: process.env.OPENAI_API_KEY,
        fetch: nodeFetch
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
}
main();
```

# TODOs
- [ ] unit tests
