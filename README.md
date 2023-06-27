# chatgpt-api
ChatGPT API

> fork from https://github.com/transitive-bullshit/chatgpt-api

- only support official API
- without conversation management
- same as usage calculation from OpenAI-official
- autoscaling messages

# examples

## nodejs
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

## browser (esm)
```html
<script type="importmap">
    {
        "imports": {
            "@llm-utils/chatgpt-api": "https://unpkg.com/@llm-utils/chatgpt-api@latest/dist/index.module.mjs"
        }
    }
</script>
<div id="app"></div>
<script type="module">
    import { ChatGPTAPI } from '@llm-utils/chatgpt-api';

    const OPENAI_API_KEY = `<YOU-API-HERE>`;

    const main = async () => {
        const api = new ChatGPTAPI({
            apiKey: OPENAI_API_KEY,
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
</script>
```

# LICENSE
GPL-V3

