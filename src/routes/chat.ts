import { Router, Request, Response } from 'express';
import { ChatCompletionRequest, ChatCompletionUsage } from '../types/openai.js';
import { createNonStreamingResponse, createStreamingResponse, generateId, getReasoningContent } from '../services/mock.js';
import { config } from '../config.js';
import { chatLimiter } from '../middleware/rate-limit.js';
import { bodySizeLimit } from '../middleware/body-size-limit.js';
import { DiskCache, countRequestTokens, countTokens } from '../services/disk-cache.js';
import { serverLogger } from '../services/logger.js';

const router = Router();
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

router.post('/v1/chat/completions', chatLimiter, bodySizeLimit, (req: Request<{}, {}, ChatCompletionRequest>, res: Response) => {
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
        diskCache.detectCommonPrefix(messages, fullContent);
        return;
      }

      const delta = result.value.choices[0]?.delta;
      if (delta?.content) fullContent += delta.content;

      res.write(`data: ${JSON.stringify(result.value)}\n\n`);

      setTimeout(sendChunk, 0);
    };

    sendChunk();
    return;
  }

  const response = createNonStreamingResponse(model, messages, reasoning_effort, tools, tool_choice);
  const content = response.choices[0]?.message?.content || '';
  const reasoningContent = response.choices[0]?.message?.reasoning_content || '';

  diskCache.persistEndPositions(messages, content);
  diskCache.detectCommonPrefix(messages, content);

  const contentTokens = countTokens(content);
  const reasoningTokens = countTokens(reasoningContent);
  response.usage = buildUsage(inputTokens, contentTokens, reasoningTokens, hitTokens, missTokens);
  response.system_fingerprint = cacheResult.hit ? 'fp_disk_cache' : undefined;

  res.json(response);
});

export default router;
