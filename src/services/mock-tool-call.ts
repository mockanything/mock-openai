import { Tool, ToolCall, ToolChoice } from '../types/openai.js';
import { generateToolCallId, isFlashModel, isProModel } from '../utils/helpers.js';

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

export function pickTools(tools: Tool[], model: string, toolChoice: ToolChoice | undefined): number[] {
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

export function createToolCalls(tools: Tool[], toolIndices: number[]): ToolCall[] {
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
