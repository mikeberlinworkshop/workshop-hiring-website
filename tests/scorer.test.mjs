// Tests for the v1 AI scorer function: prompt assembly, schema, sanitization,
// and the unconfigured/error HTTP paths. The actual Claude call is not made.
import handler, { buildSystem, buildUser, sanitizeResult, RESULT_SCHEMA } from '../netlify/functions/score-sim.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Sim = require('../sparklps/assets/sim.js');

let failures = 0;
function check(name, cond, detail) {
  if (cond) { console.log('  ok  ' + name); }
  else { failures++; console.error('FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}

const pack = Sim.PACKS.math;
const responses = {
  a1q1: 'He adds across because that is how multiplication works.',
  a1q2: 'Ask him to estimate against one whole.',
  a2q1: 'Your way makes sense for multiplying — the denominator is the size of the piece.',
  a3q1: 'Fraction tiles for access, same grade-level goal for everyone.'
};
const choices = { c1: 'c1a', c2: 'c2a', c3: 'c3a' };

// Prompt assembly: rubric in system, every response + chosen option in user.
const system = buildSystem(pack);
check('system carries all four rubric dimensions', Object.keys(Sim.DIMS).every(d => system.includes(d)));
check('system forbids hire/reject framing', system.includes('not deciding hire/reject'));
const user = buildUser(pack, responses, choices);
check('user prompt carries every candidate response', Object.values(responses).every(t => user.includes(t)));
check('user prompt carries the chosen options', user.includes('Show me where it stopped making sense'));
check('user prompt carries the student work', user.includes('5⁄9 (incorrect)'));
check('missing responses render as (no response)', buildUser(pack, {}, {}).includes('(no response)'));

// Schema is structured-outputs-safe: no numeric range constraints anywhere.
const schemaStr = JSON.stringify(RESULT_SCHEMA);
check('schema avoids unsupported minimum/maximum', !schemaStr.includes('"minimum"') && !schemaStr.includes('"maximum"'));
check('schema scores all four dims', RESULT_SCHEMA.properties.scores.required.length === 4);

// Sanitization: clamp, filter, reject.
const good = sanitizeResult({
  scores: { diagnose: 4, mindset: 3, respond: 2, scaffold: 1 },
  evidence: [{ dim: 'diagnose', quote: 'q', rationale: 'r' }, { dim: 'bogus', quote: 'x', rationale: 'y' }],
  flags: ['deficit framing'],
  followUps: [{ dim: 'scaffold', question: 'How?' }]
});
check('valid result passes through', good && good.scorer === 'ai-v1' && good.scores.diagnose === 4);
check('unknown evidence dims are dropped', good.evidence.length === 1);
const clamped = sanitizeResult({ scores: { diagnose: 9, mindset: 0, respond: 2.6, scaffold: -3 }, evidence: [], flags: [], followUps: [] });
check('out-of-range scores are clamped to 1..4', clamped.scores.diagnose === 4 && clamped.scores.mindset === 1 && clamped.scores.respond === 3 && clamped.scores.scaffold === 1);
check('missing scores reject the result', sanitizeResult({ scores: { diagnose: 3 } }) === null);
check('garbage rejects the result', sanitizeResult('nope') === null && sanitizeResult(null) === null);

// HTTP paths that never reach the API.
delete process.env.ANTHROPIC_API_KEY;
const unconfigured = await handler(new Request('http://x/', { method: 'POST', body: '{}' }));
check('503 when no API key (client falls back to v0)', unconfigured.status === 503);
const wrongMethod = await handler(new Request('http://x/', { method: 'GET' }));
check('405 on GET', wrongMethod.status === 405);
process.env.ANTHROPIC_API_KEY = 'test-key';
const badJson = await handler(new Request('http://x/', { method: 'POST', body: 'not json' }));
check('400 on malformed JSON', badJson.status === 400);
const badPack = await handler(new Request('http://x/', { method: 'POST', body: JSON.stringify({ pack: 'nope', responses: {} }) }));
check('400 on unknown pack', badPack.status === 400);

console.log(failures ? `\n${failures} failing` : '\nall scorer tests passing');
process.exit(failures ? 1 : 0);
