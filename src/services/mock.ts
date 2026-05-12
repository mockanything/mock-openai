import { ChatCompletionResponse, ChatCompletionChunkResponse, ChatMessage } from '../types/openai.js';
import { config } from '../config.js';

export function generateId(): string {
  return 'chatcmpl-' + Math.random().toString(36).substring(2, 15);
}

export function createNonStreamingResponse(
  model: string,
  messages: ChatMessage[]
): ChatCompletionResponse {
  const lastMessage = messages[messages.length - 1];
  const responseContent = config.defaultResponse;

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
          content: responseContent,
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
  messages: ChatMessage[]
): Generator<ChatCompletionChunkResponse> {
  const responseContent = config.defaultResponse;
  const words = responseContent.split(' ');

  for (let i = 0; i < words.length; i++) {
    yield {
      id: generateId(),
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          delta: {
            content: words[i] + (i < words.length - 1 ? ' ' : ''),
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