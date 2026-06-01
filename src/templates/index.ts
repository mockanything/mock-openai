import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ChatMessage } from '../types/openai.js';

const getDirname = () => {
  if (typeof __dirname !== 'undefined') return __dirname;
  return dirname(fileURLToPath(import.meta.url));
};

const modelsText = readFileSync(join(getDirname(), './models.md'), 'utf-8');
export const modelIds: string[] = modelsText.split('\n').filter(m => m.trim());

const responseDir = join(getDirname(), './response');
const responseTemplates: string[] = readdirSync(responseDir)
  .filter(f => f.endsWith('.md'))
  .sort()
  .map(f => readFileSync(join(responseDir, f), 'utf-8'));

const reasoningDir = join(getDirname(), './reasoning');
const reasoningTemplates: Record<string, string> = {
  low: readFileSync(join(reasoningDir, '01-low.md'), 'utf-8'),
  medium: readFileSync(join(reasoningDir, '02-medium.md'), 'utf-8'),
  high: readFileSync(join(reasoningDir, '03-high.md'), 'utf-8'),
  max: readFileSync(join(reasoningDir, '04-max.md'), 'utf-8'),
};

export function getReasoningContent(reasoningEffort: string = 'medium'): string {
  return reasoningTemplates[reasoningEffort] || reasoningTemplates.medium;
}

export function getResponseTemplate(messages: ChatMessage[]): string {
  let userCount = 0;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'user') userCount++;
  }
  return responseTemplates[(userCount - 1 + responseTemplates.length) % responseTemplates.length];
}
