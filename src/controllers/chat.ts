import { Request, Response } from 'express';
import { ChatCompletionRequest, ChatCompletionUsage, ChatMessage, Tool, ToolChoice } from '../types/openai.js';
import { createNonStreamingResponse } from '../services/mock-non-stream.js';
import { createStreamingResponse } from '../services/mock-stream.js';
import { getReasoningContent } from '../templates/index.js';
import { generateId, countTokens } from '../utils/helpers.js';
import { config } from '../config.js';
import { DiskCache, countRequestTokens } from '../services/mock-disk-cache.js';
import { serverLogger } from '../utils/logger.js';

const diskCache = new DiskCache();

function buildUsage(
  inputTokens: number,
  contentTokens: number,
  reasoningTokens: number,
  cacheHitTokens: number,
  cacheMissTokens: number,
): ChatCompletionUsage {
  const completionTokens = contentTokens + reasoningTokens;
  return {
    prompt_tokens: inputTokens,
    completion_tokens: completionTokens,
    total_tokens: inputTokens + completionTokens,
    prompt_cache_hit_tokens: cacheHitTokens,
    prompt_cache_miss_tokens: cacheMissTokens,
    prompt_tokens_details: { cached_tokens: cacheHitTokens },
    completion_tokens_details: { reasoning_tokens: reasoningTokens },
  };
}

function handleStreaming(
  res: Response,
  model: string,
  messages: ChatMessage[],
  reasoning_effort: string,
  tools: Tool[] | undefined,
  tool_choice: ToolChoice | undefined,
  inputTokens: number,
  hitTokens: number,
  missTokens: number,
): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const generator = createStreamingResponse(model, messages, reasoning_effort, tools, tool_choice);
  let fullContent = '';

  const sendChunk = (): void => {
    const result = generator.next();
    if (result.done) {
      const contentTokens = countTokens(fullContent);
      const reasoningTokens = countTokens(getReasoningContent(reasoning_effort));
      const usage = buildUsage(inputTokens, contentTokens, reasoningTokens, hitTokens, missTokens);
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

      diskCache.persistEndPositions(messages, fullContent);
      return;
    }

    const delta = result.value.choices[0]?.delta;
    if (delta?.content) fullContent += delta.content;

    res.write(`data: ${JSON.stringify(result.value)}\n\n`);

    setTimeout(sendChunk, 0);
  };

  sendChunk();
}

function handleNonStreaming(
  res: Response,
  model: string,
  messages: ChatMessage[],
  reasoning_effort: string,
  tools: Tool[] | undefined,
  tool_choice: ToolChoice | undefined,
  inputTokens: number,
  cacheHit: boolean,
  hitTokens: number,
  missTokens: number,
): void {
  const response = createNonStreamingResponse(model, messages, reasoning_effort, tools, tool_choice);
  const content = response.choices[0]?.message?.content || '';
  const reasoningContent = response.choices[0]?.message?.reasoning_content || '';

  diskCache.persistEndPositions(messages, content);

  const contentTokens = countTokens(content);
  const reasoningTokens = countTokens(reasoningContent);
  response.usage = buildUsage(inputTokens, contentTokens, reasoningTokens, hitTokens, missTokens);
  response.system_fingerprint = cacheHit ? 'fp_disk_cache' : undefined;

  res.json(response);
}

export function handleChatCompletion(req: Request<{}, {}, ChatCompletionRequest>, res: Response): void {
  const { model = config.defaultModel, messages, stream = false, reasoning_effort = 'medium', tools, tool_choice } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages is required' });
    return;
  }

  const cacheResult = diskCache.getHit(messages, tools);
  const inputTokens = countRequestTokens(messages, tools);
  if (cacheResult.hit) {
    serverLogger.info(`[${new Date().toISOString()}] [CACHE] model=${model} input=${inputTokens}tok HIT cached=${cacheResult.hitTokens}tok miss=${cacheResult.missTokens}tok`);
  } else {
    serverLogger.info(`[${new Date().toISOString()}] [CACHE] model=${model} input=${inputTokens}tok MISS`);
  }

  const hitTokens = cacheResult.hit ? cacheResult.hitTokens : 0;
  const missTokens = cacheResult.hit ? cacheResult.missTokens : inputTokens;

  if (stream) {
    handleStreaming(res, model, messages, reasoning_effort, tools, tool_choice, inputTokens, hitTokens, missTokens);
    return;
  }

  handleNonStreaming(res, model, messages, reasoning_effort, tools, tool_choice, inputTokens, cacheResult.hit, hitTokens, missTokens);
}
