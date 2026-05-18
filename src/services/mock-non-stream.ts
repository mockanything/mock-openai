import { ChatCompletionResponse, ToolCall } from '../types/openai.js';
import { generateId } from '../utils/helpers.js';

export function createNonStreamingResponse(
  model: string,
  content: string,
  reasoningContent: string,
  toolCalls: ToolCall[],
): ChatCompletionResponse {


  if (toolCalls.length > 0) {
    return {
      id: generateId(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          reasoning_content: reasoningContent,
          tool_calls: toolCalls,
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    };
  }

  return {
    id: generateId(),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: content,
        reasoning_content: reasoningContent,
      },
      finish_reason: 'stop',
    }],
    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
  };
}
