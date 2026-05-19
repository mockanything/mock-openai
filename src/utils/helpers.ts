import { ChatMessage, Tool } from '../types/openai.js';

export function generateId(): string {
  return 'chatcmpl-' + Math.random().toString(36).substring(2, 15);
}

export function generateToolCallId(): string {
  return 'call_' + Math.random().toString(36).substring(2, 15);
}

export function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const remaining = text.length - i;
    const chunkSize = Math.min(Math.floor(Math.random() * 10) + 10, remaining);
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize;
  }
  return chunks;
}

export function isFlashModel(model: string): boolean {
  return model.endsWith('-flash');
}

export function isProModel(model: string): boolean {
  return model.endsWith('-pro');
}

export function countTokens(text: string): number {
  let eng = 0;
  let chn = 0;
  for (const ch of text) {
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) {
      chn++;
    } else if (/\S/.test(ch)) {
      eng++;
    }
  }
  return Math.ceil(eng * 0.3 + chn * 0.6);
}

export function countRequestTokens(messages: ChatMessage[], tools?: Tool[]) {
  let contentTokens = 0;
  let reasoningTokens = 0;
  for (const msg of messages) {
    const ct = countTokens(msg.content || '');
    const rt = countTokens(msg.reasoning_content || '');
    contentTokens += ct;
    reasoningTokens += rt;
    if (msg.tool_calls) {
      contentTokens += countTokens(JSON.stringify(msg.tool_calls));
    }
  }
  if (tools) {
    contentTokens = countTokens(JSON.stringify(tools));
  }
  const total = contentTokens + reasoningTokens;
  return { total, contentTokens, reasoningTokens };
}
