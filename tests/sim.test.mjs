// Logic tests for the sim engine (scoring, payload assembly).
// Run: node tests/sim.test.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Sim = require('../sparklps/assets/sim.js');

let failures = 0;
function check(name, cond, detail) {
  if (cond) { console.log('  ok  ' + name); }
  else { failures++; console.error('FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}

const pack = Sim.PACKS.math;

// Pack integrity: every choice option references known dimensions, every
// prompt has a dimension the rubric knows about.
const dims = Object.keys(Sim.DIMS);
for (const act of pack.acts) {
  for (const p of (act.prompts || [])) {
    check(`prompt ${p.id} has a known dim`, dims.includes(p.dim), p.dim);
  }
  for (const st of (act.steps || [])) {
    if (st.type === 'free') check(`free ${st.id} has a known dim`, dims.includes(st.dim), st.dim);
    if (st.type === 'choice') {
      check(`choice ${st.id} has 4 options`, st.options.length === 4);
      for (const o of st.options) {
        for (const d of Object.keys(o.scores || {})) {
          check(`option ${o.id} scores a known dim`, dims.includes(d), d);
        }
      }
    }
  }
}
check('pack has 4 free-text prompts', Sim.allPrompts(pack).length === 4);

// Free-text scorer: direction matters more than magnitude.
const strong = Sim.scoreFreeText(
  'Jayden already understands adding fractions with a common denominator — the first problem is correct. The misconception is that he adds across the numerator and denominator, which makes sense to him because that is how multiplication works.',
  'diagnose');
const weak = Sim.scoreFreeText('He got two wrong.', 'diagnose');
const deficit = Sim.scoreFreeText(
  'Honestly some kids are just bad at math and the low students will never get fractions no matter what you do in the classroom with them.',
  'mindset');
const blank = Sim.scoreFreeText('', 'respond');
check('strong diagnostic answer scores above weak one', strong.delta > weak.delta, `${strong.delta} vs ${weak.delta}`);
check('deficit language is penalized', deficit.delta < 0, String(deficit.delta));
check('deficit language raises a flag', deficit.flags.length > 0);
check('blank response bottoms out', blank.delta === -2);

// End-to-end scoring: a strong run beats a poor run on every dimension.
const strongState = {
  responses: {
    a1q1: 'Jayden understands adding fractions with like denominators — problem one is correct. His misconception is adding across: numerator plus numerator, denominator plus denominator, the way multiplication works.',
    a1q2: 'I would ask him to estimate first: is 3/4 + 2/5 more or less than one whole? His own benchmark estimate will collide with 5/9 and he will see the problem himself.',
    a2q1: 'Maria, your way makes sense for multiplying — that is the frustrating part. But the denominator is the size of the piece, not a count. Fourths and fifths are different sizes, so we make them the same size first. Show me with the fraction tiles?',
    a3q1: 'Two changes: fraction tiles and a number line on every table, and I pre-teach the warm-up to my five IEP students so they walk in ready. What stays the same: every student works the same grade-level problems toward the same goal.'
  },
  choices: { c1: 'c1a', c2: 'c2a', c3: 'c3a' },
  timings: { artifact: 180, moment: 300, adapt: 150 }
};
const poorState = {
  responses: {
    a1q1: 'He is just wrong, he needs to memorize the steps better honestly.',
    a1q2: 'I would tell him the steps again so he stops making mistakes on it.',
    a2q1: 'Because that is not the rule, you have to find a common denominator first, just follow the steps I showed you.',
    a3q1: 'I would give the IEP kids an easier worksheet so they are not frustrated by the grade level work.'
  },
  choices: { c1: 'c1c', c2: 'c2c', c3: 'c3b' },
  timings: { artifact: 60, moment: 90, adapt: 40 }
};
const s = Sim.computeScores(pack, strongState.responses, strongState.choices);
const p = Sim.computeScores(pack, poorState.responses, poorState.choices);
for (const d of dims) {
  check(`strong > poor on ${d}`, s.dims[d] > p.dims[d], `${s.dims[d]} vs ${p.dims[d]}`);
  check(`${d} within 1..4 (strong)`, s.dims[d] >= 1 && s.dims[d] <= 4);
  check(`${d} within 1..4 (poor)`, p.dims[d] >= 1 && p.dims[d] <= 4);
  check(`evidence exists for ${d}`, (s.evidence[d] || []).length > 0);
}

// Follow-ups target the weak dimensions only.
const fu = Sim.followUps({ diagnose: 4, mindset: 2, respond: 3, scaffold: 1 });
check('follow-ups for dims <= 2 only', fu.length === 2 && fu.every(f => ['mindset', 'scaffold'].includes(f.dim)));

// Payload assembly.
const payload = Sim.buildPayload(pack, { ...strongState, candidate: { name: 'T. Est', email: 't@e.st' } });
check('payload totals timings', payload.totalSeconds === 630, String(payload.totalSeconds));
check('payload carries candidate', payload.candidate.name === 'T. Est');
check('payload carries scores + evidence + followUps',
  !!payload.scores && !!payload.evidence && Array.isArray(payload.followUps));

console.log(failures ? `\n${failures} failing` : '\nall logic tests passing');
process.exit(failures ? 1 : 0);
