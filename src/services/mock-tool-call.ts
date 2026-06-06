import { Tool, ToolCall, ToolChoice } from '../types/openai.js';
import { generateToolCallId, isFlashModel, isProModel } from '../utils/helpers.js';

function generateSmartMockValue(
  toolName: string,
  paramName: string,
  schema: Record<string, unknown> | undefined,
): unknown {
  if (!schema) return null;
  const type = schema.type as string | undefined;
  const name = paramName.toLowerCase();
  const tool = toolName.toLowerCase();

  switch (type) {
  case 'string': {
    if (name.includes('path')) {
      if (tool.includes('read')) {
        return 'README.md'
      }
      return '/tmp/' + Math.random().toString(36).substring(2, 10);
    }
    if (name.includes('command') || name.includes('cmd')) return 'cat ~/.bashrc';
    if (name.includes('file') || name.includes('name')) {
      if (tool.includes('read')) {
        return 'README.md'
      }
      return '/tmp/test.txt';
    }
    if (name.includes('url') || name.includes('uri')) return 'https://example.com';
    if (name.includes('email')) return 'user@example.com';
    if (name.includes('phone') || name.includes('tel')) return '555-0100';
    if (name.includes('query')) return tool.includes('search') ? 'example search query' : 'query';
    if (name.includes('id')) return 'id_' + Math.random().toString(36).substring(2, 8);
    if (name.includes('desc') || name.includes('message') || name.includes('content')) return 'This is a mock response';
    if (name.includes('type')) return 'default';
    if (name.includes('format') || name.includes('ext')) return 'json';
    if (name.includes('status')) return 'active';
    if (name.includes('role')) return 'user';
    if (name.includes('lang')) return 'en';
    if (name.includes('version') || name.includes('ver')) return '1.0.0';
    if (name.includes('branch')) return '';
    if (name.includes('dir') || name.includes('folder')) {
      if (tool.includes('read')) {
        return 'src'
      }
      return '/tmp/output';
    }
    return 'mock_value';
  }
  case 'number':
  case 'integer': {
    if (name.includes('count') || name.includes('limit') || name.includes('max') || name.includes('size')) return 100;
    if (name.includes('min')) return 1;
    if (name.includes('page')) return 1;
    if (name.includes('port')) return 8080;
    if (name.includes('timeout')) return 30000;
    if (name.includes('temperature')) return 0.7;
    if (name.includes('top_p') || name.includes('top')) return 0.9;
    return 42;
  }
  case 'boolean': {
    return true;
  }
  case 'array': {
    const itemsSchema = schema.items as Record<string, unknown> | undefined;
    if (itemsSchema) {
      return [generateSmartMockValue(toolName, paramName, itemsSchema)];
    }
    return [];
  }
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
    result[key] = generateSmartMockValue(toolFn.name, key, propSchema);
  }

  for (const key of Object.keys(properties)) {
    if (!required.includes(key) && Math.random() < 0.5) {
      const propSchema = properties[key] as Record<string, unknown> | undefined;
      result[key] = generateSmartMockValue(toolFn.name, key, propSchema);
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

  if (toolChoice === 'required' || model.startsWith('benchmark-')) {
    // Required tools and benchmark models always call tools
  } else if (isFlash && Math.random() < 0.9) {
    // Flash models have a high chance to call all tools
  } else if (isPro && Math.random() < 0.95) {
    // Pro models have a high chance to call some tools
  } else {
    return [];
  }

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
