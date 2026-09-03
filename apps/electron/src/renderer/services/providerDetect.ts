/**
 * Utility to accurately detect and format the LLM provider name
 * based on the configured API base URL, model identifier, and explicit provider setting.
 */

export function detectProvider(
  baseUrl?: string,
  model?: string,
  explicitProvider?: string
): string {
  // If user explicitly configured a custom provider name (and not legacy hardcoded 'Anthropic')
  if (explicitProvider && explicitProvider !== 'Anthropic' && explicitProvider !== 'OpenAI') {
    return explicitProvider;
  }

  const cleanUrl = (baseUrl || '').toLowerCase().trim();
  const cleanModel = (model || '').toLowerCase().trim();

  // 1. Detect from Base URL host / endpoint patterns
  if (cleanUrl.includes('bynara.id') || cleanUrl.includes('bynara')) {
    return 'byNara';
  }
  if (cleanUrl.includes('openrouter.ai')) {
    return 'OpenRouter';
  }
  if (cleanUrl.includes('api.openai.com')) {
    return 'OpenAI';
  }
  if (cleanUrl.includes('anthropic.com')) {
    return 'Anthropic';
  }
  if (cleanUrl.includes('groq.com')) {
    return 'Groq';
  }
  if (cleanUrl.includes('deepseek.com')) {
    return 'DeepSeek';
  }
  if (cleanUrl.includes('mistral.ai')) {
    return 'Mistral AI';
  }
  if (cleanUrl.includes('together.xyz') || cleanUrl.includes('together.ai')) {
    return 'Together AI';
  }
  if (cleanUrl.includes('11434') || cleanUrl.includes('ollama')) {
    return 'Ollama (Local)';
  }
  if (cleanUrl.includes('1234') || cleanUrl.includes('lmstudio') || cleanUrl.includes('lm-studio')) {
    return 'LM Studio (Local)';
  }

  // 2. Detect from Model Identifier prefixes
  if (cleanModel.startsWith('agnes')) {
    return 'byNara';
  }
  if (cleanModel.startsWith('claude')) {
    return 'Anthropic';
  }
  if (
    cleanModel.startsWith('gpt') ||
    cleanModel.startsWith('o1') ||
    cleanModel.startsWith('o3') ||
    cleanModel.startsWith('chatgpt')
  ) {
    return 'OpenAI';
  }
  if (cleanModel.startsWith('gemini')) {
    return 'Google Gemini';
  }
  if (cleanModel.startsWith('deepseek')) {
    return 'DeepSeek';
  }
  if (cleanModel.startsWith('qwen')) {
    return 'Qwen / Alibaba';
  }
  if (cleanModel.startsWith('llama')) {
    return 'Meta Llama';
  }
  if (cleanModel.startsWith('mistral') || cleanModel.startsWith('codestral')) {
    return 'Mistral';
  }

  // 3. Fallback to host name if custom endpoint URL is provided
  if (cleanUrl) {
    try {
      const parsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : `http://${cleanUrl}`);
      if (parsed.hostname && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
        return parsed.hostname;
      }
      return 'Local Endpoint';
    } catch {
      return 'Custom Endpoint';
    }
  }

  if (explicitProvider) return explicitProvider;
  return 'Custom / Compatible';
}
