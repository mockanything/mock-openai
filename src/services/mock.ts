import { ChatCompletionResponse, ChatCompletionChunkResponse, ChatMessage } from '../types/openai.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const getDirname = () => {
  if (typeof __dirname !== 'undefined') return __dirname;
  return dirname(fileURLToPath(import.meta.url));
};

const templatesDir = join(getDirname(), '../templates');
const responseTemplate = readFileSync(join(templatesDir, 'glamour.md'), 'utf-8');

const reasoningDir = join(getDirname(), '../templates/reasoning');
const reasoningTemplates: Record<string, string> = {
  low: readFileSync(join(reasoningDir, '01-low.md'), 'utf-8'),
  medium: readFileSync(join(reasoningDir, '02-medium.md'), 'utf-8'),
  high: readFileSync(join(reasoningDir, '03-high.md'), 'utf-8'),
  max: readFileSync(join(reasoningDir, '04-max.md'), 'utf-8'),
};

export function generateId(): string {
  return 'chatcmpl-' + Math.random().toString(36).substring(2, 15);
}

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const remaining = text.length - i;
    const chunkSize = Math.min(Math.floor(Math.random() * 5) + 1, remaining);
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize;
  }
  return chunks;
}

function getReasoningContent(reasoningEffort: string = 'medium'): string {
  return reasoningTemplates[reasoningEffort] || reasoningTemplates.medium;
}

export function createNonStreamingResponse(
  model: string,
  messages: ChatMessage[],
  reasoningEffort: string = 'medium'
): ChatCompletionResponse {
  const lastMessage = messages[messages.length - 1];
  const chainOfThought = getReasoningContent(reasoningEffort);

  return {
    id: generateId(),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: responseTemplate,
          reasoning_content: chainOfThought,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 10,
      total_tokens: 20,
    },
  };
}

export function* createStreamingResponse(
  model: string,
  messages: ChatMessage[],
  reasoningEffort: string = 'medium'
): Generator<ChatCompletionChunkResponse> {
  const reasoningContent = getReasoningContent(reasoningEffort);

  const reasonChunks = splitIntoChunks(reasoningContent);
  for (const chunk of reasonChunks) {
    yield {
      id: generateId(),
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          delta: {
            reasoning_content: chunk,
          },
          finish_reason: null,
        },
      ],
    };
  }

  const contentChunks = splitIntoChunks(responseTemplate);
  for (const chunk of contentChunks) {
    yield {
      id: generateId(),
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          delta: {
            content: chunk,
          },
          finish_reason: null,
        },
      ],
    };
  }

  yield {
    id: generateId(),
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: 'stop',
      },
    ],
  };
}