import { NoApiKeyError } from '@/lib/ai/errors';
import { generateStoryFrame as generateDoubao } from '@/lib/ai/doubao';
import { generateStoryFrame as generateDeepseek } from '@/lib/ai/deepseek';

export { NoApiKeyError };

// Env-preference provider resolver (ADR-2):
//   1. DOUBAO_API_KEY set  -> Doubao (primary, higher SVG quality)
//   2. DEEPSEEK_API_KEY set -> DeepSeek (fallback, faster)
//   3. neither              -> throw NoApiKeyError -> route mock fallback fires
//
// This is the single place provider selection happens. Both routes
// (/api/story/generate and /api/story/hint) import from here.
export async function generateStoryFrame(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  if (process.env.DOUBAO_API_KEY) {
    return generateDoubao(systemPrompt, userMessage);
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return generateDeepseek(systemPrompt, userMessage);
  }
  throw new NoApiKeyError();
}

export async function generateStoryFrameSemantic(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new NoApiKeyError();
  }
  return generateDeepseek(systemPrompt, userMessage);
}
