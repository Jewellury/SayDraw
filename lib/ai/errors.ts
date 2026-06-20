export class NoApiKeyError extends Error {
  constructor() {
    super('No AI provider API key is set (DOUBAO_API_KEY or DEEPSEEK_API_KEY)');
    this.name = 'NoApiKeyError';
  }
}
