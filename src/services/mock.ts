import { ChatCompletionResponse, ChatCompletionChunkResponse, ChatMessage, Tool, ToolCall, ToolChoice } from '../types/openai.js';
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

function generateToolCallId(): string {
  return 'call_' + Math.random().toString(36).substring(2, 15);
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

function isFlashModel(model: string): boolean {
  return model.endsWith('-flash');
}

function isProModel(model: string): boolean {
  return model.endsWith('-pro');
}

function generateMockValue(schema: Record<string, unknown> | undefined): unknown {
  if (!schema) return null;
  const type = schema.type as string | undefined;
  switch (type) {
    case 'string': return 'mock_value';
    case 'number':
    case 'integer': return 42;
    case 'boolean': return true;
    case 'array': return [];
    case 'object': return {};
    default: return null;
  }
}

function generateMockArguments(toolFn: { name: string; parameters?: Record<string, unknown> }): string {
  const params = toolFn.parameters as Record<string, unknown> | undefined;
  if (!params) return JSON.stringify({ mock: true, tool: toolFn.name });

  const properties = params.properties as Record<string, unknown> | undefined;
  if (!properties) return JSON.stringify({ mock: true, tool: toolFn.name });

  const required = (params.required as string[]) || [];
  const result: Record<string, unknown> = {};

  for (const key of required) {
    const propSchema = properties[key] as Record<string, unknown> | undefined;
    result[key] = generateMockValue(propSchema);
  }

  for (const key of Object.keys(properties)) {
    if (!required.includes(key) && Math.random() < 0.5) {
      const propSchema = properties[key] as Record<string, unknown> | undefined;
      result[key] = generateMockValue(propSchema);
    }
  }

  return JSON.stringify(result);
}

function pickTools(tools: Tool[], model: string, toolChoice: ToolChoice | undefined): number[] {
  if (toolChoice === 'none') return [];

  if (toolChoice && typeof toolChoice === 'object' && toolChoice.type === 'function') {
    const idx = tools.findIndex(t => t.function.name === toolChoice.function.name);
    return idx >= 0 ? [idx] : [];
  }

  const isFlash = isFlashModel(model);
  const isPro = isProModel(model);

  if (!isFlash && !isPro) return [];

  if (toolChoice !== 'required' && isFlash && Math.random() >= 0.8) return [];

  const n = tools.length;
  const maxCalls = isPro ? n : Math.max(1, Math.floor(n / 2));
  const callCount = Math.floor(Math.random() * maxCalls) + 1;

  const indices = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5);
  return indices.slice(0, callCount).sort();
}

function createToolCalls(tools: Tool[], toolIndices: number[]): ToolCall[] {
  return toolIndices.map(idx => {
    const tool = tools[idx];
    return {
      id: generateToolCallId(),
      type: 'function',
      function: {
        name: tool.function.name,
        arguments: generateMockArguments(tool.function),
      },
    };
  });
}

export function createNonStreamingResponse(
  model: string,
  messages: ChatMessage[],
  reasoningEffort: string = 'medium',
  tools?: Tool[],
  toolChoice?: ToolChoice
): ChatCompletionResponse {
  const chainOfThought = getReasoningContent(reasoningEffort);
  const toolIndices = tools ? pickTools(tools, model, toolChoice) : [];

  if (toolIndices.length > 0) {
    const toolCalls = createToolCalls(tools!, toolIndices);
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
          reasoning_content: chainOfThought,
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
        content: responseTemplate,
        reasoning_content: chainOfThought,
      },
      finish_reason: 'stop',
    }],
    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
  };
}

export function* createStreamingResponse(
  model: string,
  messages: ChatMessage[],
  reasoningEffort: string = 'medium',
  tools?: Tool[],
  toolChoice?: ToolChoice
): Generator<ChatCompletionChunkResponse> {
  const reasoningContent = getReasoningContent(reasoningEffort);
  const toolIndices = tools ? pickTools(tools, model, toolChoice) : [];

  const reasonChunks = splitIntoChunks(reasoningContent);
  for (const chunk of reasonChunks) {
    yield {
      id: generateId(),
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        delta: { reasoning_content: chunk },
        finish_reason: null,
      }],
    };
  }

  if (toolIndices.length > 0) {
    const toolCalls = createToolCalls(tools!, toolIndices);

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

  const contentChunks = splitIntoChunks(responseTemplate);
  for (const chunk of contentChunks) {
    yield {
      id: generateId(),
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        delta: { content: chunk },
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
