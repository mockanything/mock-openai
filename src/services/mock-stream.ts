import { ChatCompletionChunkResponse, ToolCall } from '../types/openai.js';
import { generateId, splitIntoChunks } from '../utils/helpers.js';

export function* createStreamingResponse(
  model: string,
  content: string,
  reasoningContent: string,
  toolCalls: ToolCall[],
): Generator<ChatCompletionChunkResponse> {


  const reasonChunks = splitIntoChunks(reasoningContent);
  for (const chunk of reasonChunks) {
    yield {
      id: generateId(),
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        delta: { role: 'assistant', reasoning_content: chunk },
        finish_reason: null,
      }],
    };
  }

  if (toolCalls.length > 0) {

    for (let i = 0; i < toolCalls.length; i++) {
      const tc = toolCalls[i];
      const argChunks = splitIntoChunks(tc.function.arguments);

      yield {
        id: generateId(),
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
          index: 0,
          delta: {
            tool_calls: [{
              index: i,
              id: tc.id,
              type: 'function',
              function: { name: tc.function.name, arguments: argChunks[0] },
            }],
          },
          finish_reason: null,
        }],
      };

      for (let j = 1; j < argChunks.length; j++) {
        yield {
          id: generateId(),
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{
            index: 0,
            delta: {
              tool_calls: [{
                index: i,
                function: { arguments: argChunks[j] },
              }],
            },
            finish_reason: null,
          }],
        };
      }
    }

    yield {
      id: generateId(),
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'tool_calls',
      }],
    };
    return;
  }

  const contentChunks = splitIntoChunks(content);
  for (const chunk of contentChunks) {
    yield {
      id: generateId(),
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        delta: { role: 'assistant', content: chunk },
        finish_reason: null,
      }],
    };
  }

  yield {
    id: generateId(),
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      delta: {},
      finish_reason: 'stop',
    }],
  };
}
