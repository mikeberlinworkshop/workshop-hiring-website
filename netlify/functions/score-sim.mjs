// v1 AI scorer for the classroom sim — Netlify Function.
// Receives the candidate's free-text responses + choice path and returns
// rubric scores with justifying quotes and interview follow-ups. This is the
// seam described in docs/teacher-sim-strategy.md: when ANTHROPIC_API_KEY is
// unset (or this function is unreachable), the client keeps the v0 heuristic
// scores, so the sim never blocks on the scorer.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Sim = require('../../sparklps/assets/sim.js');

const MODEL = 'claude-opus-4-8';

// Structured-output schema: numeric range constraints aren't supported, so
// scores use enum [1,2,3,4].
const SCORE = { type: 'integer', enum: [1, 2, 3, 4] };
export const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    scores: {
      type: 'object',
      properties: { diagnose: SCORE, mindset: SCORE, respond: SCORE, scaffold: SCORE },
      required: ['diagnose', 'mindset', 'respond', 'scaffold'],
      additionalProperties: false
    },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          dim: { type: 'string', enum: ['diagnose', 'mindset', 'respond', 'scaffold'] },
          quote: { type: 'string', description: 'Verbatim excerpt from the candidate response that justifies the score' },
          rationale: { type: 'string', description: 'One sentence: why this quote moves the score up or down' }
        },
        required: ['dim', 'quote', 'rationale'],
        additionalProperties: false
      }
    },
    flags: { type: 'array', items: { type: 'string' }, description: 'Deficit framing, factual math errors, or red flags a principal must read verbatim' },
    followUps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          dim: { type: 'string', enum: ['diagnose', 'mindset', 'respond', 'scaffold'] },
          question: { type: 'string', description: 'Interview question built from this candidate’s own answer' }
        },
        required: ['dim', 'question'],
        additionalProperties: false
      }
    }
  },
  required: ['scores', 'evidence', 'flags', 'followUps'],
  additionalProperties: false
};

// System prompt is stable per pack — cache_control makes repeat scoring cheap.
export function buildSystem(pack) {
  const rubric = Object.entries(Sim.DIMS)
    .map(([dim, label]) => `- ${dim}: ${label}`)
    .join('\n');
  return [
    'You score teacher-candidate responses from a 10-minute classroom simulation for a middle school. ' +
    'You are not deciding hire/reject — you are preparing an evidence pack so a principal can decide who gets an interview and what to ask them.',
    '',
    'Rubric (score each dimension 1–4):',
    rubric,
    '',
    'Anchors: 4 = specific to THIS student’s thinking, asset-framed, holds the grade-level bar; ' +
    '3 = sound practice, somewhat generic; 2 = procedural re-explaining, vague positivity, or scaffolds that lower the goal; ' +
    '1 = deficit framing, gives the answer away, or no real response.',
    '',
    'Rules: quote the candidate verbatim in evidence (never paraphrase inside `quote`); ' +
    'flag deficit language about students; write one follow-up interview question per dimension scored 2 or below, ' +
    'built from the candidate’s own words so the principal can probe it live. Judge the substance, not the polish — ' +
    'typos and informal tone are fine; scoring is about how they think about students and math.'
  ].join('\n');
}

export function buildUser(pack, responses, choices) {
  const parts = [`Simulation pack: ${pack.roleLabel}.`, ''];
  for (const act of pack.acts) {
    parts.push(`## ${act.title}`, act.intro);
    if (act.work) {
      parts.push('Student work shown: ' + act.work.map(w => `${w.problem} ${w.answer}${w.correct ? ' (correct)' : ' (incorrect)'}`).join('; '));
    }
    for (const p of Sim.allPrompts({ acts: [act] })) {
      parts.push(`Prompt (${p.dim}): ${p.label}`, `Candidate response: """${responses[p.id] || '(no response)'}"""`);
    }
    for (const st of act.steps || []) {
      if (st.type === 'choice' && choices[st.id]) {
        const opt = Sim.findOption(pack, st.id, choices[st.id]);
        if (opt) parts.push(`Choice point — ${st.label}`, `Candidate chose: ${opt.text}`);
      }
    }
    parts.push('');
  }
  parts.push('Score all four dimensions using both the typed responses and the choice path.');
  return parts.join('\n');
}

// Defense against a malformed or partial model response: clamp scores, keep
// only known dimensions, never let a bad scorer result corrupt the payload.
export function sanitizeResult(raw) {
  if (!raw || typeof raw !== 'object' || !raw.scores) return null;
  const dims = Object.keys(Sim.DIMS);
  const scores = {};
  for (const d of dims) {
    const v = Math.round(Number(raw.scores[d]));
    if (!Number.isFinite(v)) return null;
    scores[d] = Math.min(4, Math.max(1, v));
  }
  const keepDim = e => e && dims.includes(e.dim);
  return {
    scorer: 'ai-v1',
    model: MODEL,
    scores,
    evidence: (Array.isArray(raw.evidence) ? raw.evidence : []).filter(keepDim),
    flags: (Array.isArray(raw.flags) ? raw.flags : []).map(String),
    followUps: (Array.isArray(raw.followUps) ? raw.followUps : []).filter(keepDim)
  };
}

export default async function handler(req) {
  if (req.method !== 'POST') return Response.json({ error: 'method-not-allowed' }, { status: 405 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: 'scorer-unconfigured' }, { status: 503 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'bad-json' }, { status: 400 }); }
  const pack = Sim.PACKS[body.pack];
  if (!pack || typeof body.responses !== 'object') return Response.json({ error: 'bad-request' }, { status: 400 });

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: [{ type: 'text', text: buildSystem(pack), cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildUser(pack, body.responses, body.choices || {}) }],
    output_config: { format: { type: 'json_schema', schema: RESULT_SCHEMA } }
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const result = sanitizeResult(textBlock ? JSON.parse(textBlock.text) : null);
  if (!result) return Response.json({ error: 'unscorable' }, { status: 502 });
  return Response.json(result);
}
