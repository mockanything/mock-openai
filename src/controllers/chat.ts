import { Request, Response } from 'express';
import { ChatCompletionRequest, ChatCompletionChunkResponse, ChatCompletionUsage, ChatMessage, ToolCall } from '../types/openai.js';
import { createNonStreamingResponse } from '../services/mock-non-stream.js';
import { createToolCalls, pickTools } from '../services/mock-tool-call.js';
import { createStreamingResponse } from '../services/mock-stream.js';
import { getReasoningContent, getResponseTemplate } from '../templates/index.js';
import { generateId, countTokens, countRequestTokens } from '../utils/helpers.js';
import { config } from '../config.js';
import { DiskCache } from '../services/mock-disk-cache.js';
import { serverLogger } from '../utils/logger.js';

const diskCache = new DiskCache();

function buildUsage(
  inputTokens: number,
  inputContentTokens: number,
  inputReasoningTokens: number,
  outputContentTokens: number,
  outputReasoningTokens: number,
  cacheHitTokens: number,
  cacheMissTokens: number,
): ChatCompletionUsage {
  const completionTokens = outputContentTokens + outputReasoningTokens;
  return {
    prompt_tokens: inputTokens,
    completion_tokens: completionTokens,
    total_tokens: inputTokens + completionTokens,
    prompt_cache_hit_tokens: cacheHitTokens,
    prompt_cache_miss_tokens: cacheMissTokens,
    prompt_tokens_details: {
      cached_tokens: cacheHitTokens,
      reasoning_tokens: inputReasoningTokens,
      content_tokens: inputContentTokens,
    },
    completion_tokens_details: { reasoning_tokens: outputReasoningTokens, content_tokens: outputContentTokens },
  };
}

function handleNonStreaming(
  res: Response,
  model: string,
  messages: ChatMessage[],
  content: string,
  reasoning_content: string,
  tools: ToolCall[],
  usage: ChatCompletionUsage,
): void {
  const response = createNonStreamingResponse(model, content, reasoning_content, tools);
  diskCache.persistEndpoints(messages);
  response.usage = usage;
  res.json(response);
}


function handleStreaming(
  res: Response,
  model: string,
  messages: ChatMessage[],
  content: string,
  reasoning_content: string,
  tools: ToolCall[],
  usage: ChatCompletionUsage,
): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const generator = createStreamingResponse(model, content, reasoning_content, tools);

  const chunks: ChatCompletionChunkResponse[] = [];
  for (const chunk of generator) {
    chunks.push(chunk);
  }

  const done = (): void => {
    res.write(`data: ${JSON.stringify({
      id: generateId(),
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [],
      usage,
    })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    diskCache.persistEndpoints(messages);
  };

  let idx = 0;
  const BATCH = 100;
  const drain = (): void => {
    const end = Math.min(idx + BATCH, chunks.length);
    let buf = '';
    for (; idx < end; idx++) {
      buf += `data: ${JSON.stringify(chunks[idx])}\n\n`;
    }
    res.write(buf);
    if (idx < chunks.length) {
      setTimeout(drain, 10);
    } else {
      done();
    }
  };
  drain();
}

export function handleChatCompletion(req: Request<{}, {}, ChatCompletionRequest>, res: Response): void {
  const { model = config.defaultModel, messages, stream = false, reasoning_effort = 'low', tools, tool_choice } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages is required' });
    return;
  }

  const cacheResult = diskCache.getHit(messages, tools);
  const { total: inputTokens, contentTokens: inputContentTokens, reasoningTokens: inputReasoningTokens } = countRequestTokens(messages, tools);
  if (cacheResult.hit) {
    serverLogger.info(`[CACHE] model=${model} msg_length=${messages.length} hit_length=${cacheResult.hitLength} input=${inputTokens} cached=${cacheResult.hitTokens} miss=${cacheResult.missTokens}`);
  } else {
    serverLogger.info(`[CACHE] model=${model} msg_length=${messages.length} hit_length=0 input=${inputTokens} MISS`);
  }

  const hitTokens = cacheResult.hit ? cacheResult.hitTokens : 0;
  const missTokens = cacheResult.hit ? cacheResult.missTokens : inputTokens;

  const outputContent = getResponseTemplate(messages);
  const outputReasoningContent = getReasoningContent(reasoning_effort);
  const toolIndices = tools ? pickTools(tools, model, tool_choice) : [];
  const toolCalls = createToolCalls(tools!, toolIndices);

  serverLogger.info(`[TOOLS] model=${model} tools=${toolCalls.map(t => t.function.name).join(',')}`);
  if (toolCalls.length > 0) {
    serverLogger.info(`[TOOLS] model=${model} tool_calls=${toolCalls.map(item => item.function.name).join(',')} `);
  } else {
    serverLogger.info(`[TOOLS] model=${model} tool_calls=none`);
  }

  const outputContentTokens = countTokens(outputContent);
  const outputReasoningTokens = countTokens(getReasoningContent(outputReasoningContent));

  const usage = buildUsage(inputTokens, inputContentTokens, inputReasoningTokens, outputContentTokens, outputReasoningTokens, hitTokens, missTokens);

  if (stream) {
    handleStreaming(res, model, messages, outputContent, outputReasoningContent, toolCalls, usage);
    return;
  }

  handleNonStreaming(res, model, messages, outputContent, outputReasoningContent, toolCalls, usage);
}
