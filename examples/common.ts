import dotenv from "dotenv";
dotenv.config();

import { ChatGPTAPI, types } from "../build";
import proxy from "https-proxy-agent";
import nodeFetch from "node-fetch-retry";

const fetcher = process.env.HTTP_PROXY
  ? (((url: any, options = {}) => {
      const defaultOptions = {
        agent: proxy(process.env.HTTP_PROXY!),
      };

      const mergedOptions = {
        ...defaultOptions,
        ...options,
      };

      return nodeFetch(url, mergedOptions);
    }) as any)
  : nodeFetch;

export const buildAPI = (opts: types.ChatGPTAPIOptions) =>
  new ChatGPTAPI({
    fetch: fetcher,
    ...opts,
  });
