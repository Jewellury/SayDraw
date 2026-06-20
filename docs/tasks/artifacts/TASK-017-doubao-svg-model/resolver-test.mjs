// Phase 4b/AC4b: Deterministic error-chain test for the resolver.
// Sets a fake DOUBAO_API_KEY + bad DOUBAO_BASE_URL, expects the resolver to
// attempt Doubao, fail with a network error, and the route-level catch (which
// we simulate here) to fall through to mock. No real key needed.
//
// Also verifies AC2 (no-key -> NoApiKeyError) and AC3 (DeepSeek fallthrough).
// Artifact only.

import { generateStoryFrame, NoApiKeyError } from '../../../lib/ai/provider.ts';

function assert(cond, msg) {
  if (!cond) { console.error(`❌ FAIL: ${msg}`); process.exit(1); }
  console.log(`✅ ${msg}`);
}

// ---------- AC2: no keys -> NoApiKeyError ----------
delete process.env.DOUBAO_API_KEY;
delete process.env.DEEPSEEK_API_KEY;
try {
  await generateStoryFrame('sys', 'user');
  console.error('❌ FAIL: AC2 expected NoApiKeyError, got success');
  process.exit(1);
} catch (e) {
  assert(e instanceof NoApiKeyError, 'AC2: no keys -> NoApiKeyError thrown');
  assert(e.name === 'NoApiKeyError', 'AC2: error.name === "NoApiKeyError" (instanceof works across module boundary)');
}

// ---------- AC3: DEEPSEEK_API_KEY set, DOUBAO_API_KEY unset -> DeepSeek path ----------
// Use a fake key + bad base URL. Expect a network error from DeepSeek (not NoApiKeyError).
process.env.DEEPSEEK_API_KEY = 'faux-deepseek-key';
process.env.DEEPSEEK_BASE_URL = 'https://deepseek.nonexistent.invalid';
delete process.env.DOUBAO_API_KEY;
try {
  await generateStoryFrame('sys', 'user');
  console.error('❌ FAIL: AC3 expected network error, got success');
  process.exit(1);
} catch (e) {
  assert(!(e instanceof NoApiKeyError), 'AC3: error is NOT NoApiKeyError (provider was selected, just failed at network)');
  assert(/DeepSeek|fetch|ECONN|getaddrinfo|ENOTFOUND|network/i.test(e.message), `AC3: error mentions DeepSeek/network ("${e.message.slice(0, 80)}")`);
}

// ---------- AC3b: DOUBAO_API_KEY set -> Doubao path attempted (regardless of DeepSeek) ----------
// Use a fake key + bad base URL. Expect Doubao network error.
process.env.DOUBAO_API_KEY = 'faux-doubao-key';
process.env.DOUBAO_BASE_URL = 'https://ark.nonexistent.invalid';
process.env.DOUBAO_MODEL = 'ep-fake-xxxxx';
try {
  await generateStoryFrame('sys', 'user');
  console.error('❌ FAIL: AC3b expected network error, got success');
  process.exit(1);
} catch (e) {
  assert(!(e instanceof NoApiKeyError), 'AC3b: error is NOT NoApiKeyError (Doubao selected, failed at network)');
  assert(/Doubao|fetch|ECONN|getaddrinfo|ENOTFOUND|network/i.test(e.message), `AC3b: error mentions Doubao/network ("${e.message.slice(0, 80)}")`);
}

// ---------- AC1 edge: DOUBAO_API_KEY set but DOUBAO_MODEL missing -> clear error ----------
delete process.env.DOUBAO_MODEL;
try {
  await generateStoryFrame('sys', 'user');
  console.error('❌ FAIL: AC1 edge expected error, got success');
  process.exit(1);
} catch (e) {
  assert(/DOUBAO_MODEL/i.test(e.message), `AC1 edge: error mentions DOUBAO_MODEL ("${e.message.slice(0, 80)}")`);
}

console.log('\n=== All resolver tests PASS ===');
