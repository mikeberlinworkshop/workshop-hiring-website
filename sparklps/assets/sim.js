// Spark classroom sim engine: scenario packs, state machine, and v0 heuristic
// scoring. Pure logic lives on SparkSim so Node tests and the review page can
// reuse it; DOM wiring is in sim/index.html. scoreFreeText is the seam that a
// server-side AI scorer replaces in v1 — nothing else needs to change.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) { module.exports = factory(); }
  else { root.SparkSim = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {

  var DIMS = {
    diagnose: 'Diagnosing student thinking',
    mindset: 'Mindset & expectations',
    respond: 'Responsive instruction',
    scaffold: 'Inclusive scaffolding'
  };

  // One scenario pack per subject/grade band. Packs are data: a science or
  // history pack is a new entry here, not new code.
  var PACKS = {
    math: {
      id: 'math',
      roleLabel: 'Middle School Math (Grades 6–8)',
      minutes: 11,
      acts: [
        {
          id: 'artifact',
          title: 'Read the student’s thinking',
          kicker: 'Act 1 of 3 · about 3 minutes',
          intro: 'Jayden, a 7th grader, just handed in this practice set on adding fractions. Look at all three problems before you answer.',
          work: [
            { problem: '1⁄4 + 2⁄4 =', answer: '3⁄4', correct: true },
            { problem: '3⁄4 + 2⁄5 =', answer: '5⁄9', correct: false },
            { problem: '1⁄2 + 1⁄3 =', answer: '2⁄5', correct: false }
          ],
          prompts: [
            { id: 'a1q1', dim: 'diagnose',
              label: 'What does Jayden already understand, and what exactly is the misconception?',
              placeholder: 'Be specific about the math — what is he doing, and why might it make sense to him?' },
            { id: 'a1q2', dim: 'respond',
              label: 'You’re at his desk. What’s the first thing you do or say?',
              placeholder: 'Write it the way it would actually happen.' }
          ]
        },
        {
          id: 'moment',
          title: 'The moment',
          kicker: 'Act 2 of 3 · about 5 minutes',
          intro: 'Period 3, Tuesday. Your class is practicing adding unlike fractions — you planned to move on tomorrow. Maria, who has worked hard all week, pushes her paper away.',
          steps: [
            { type: 'say', who: 'Maria',
              text: 'I’m never going to get this. I’m just bad at math. My mom says she was bad at math too.' },
            { type: 'choice', id: 'c1', label: 'What’s your first move?',
              options: [
                { id: 'c1a', text: '“You’re not bad at math — this is hard, and you’ve been doing the hard part all week. Show me where it stopped making sense.”',
                  scores: { mindset: 2, respond: 1 },
                  reply: 'Maria pulls the paper back and points at one problem.' },
                { id: 'c1b', text: '“Don’t say that! Stay positive — keep practicing and it’ll click.”',
                  scores: { mindset: 0 },
                  reply: 'Maria shrugs and stares at the paper. After a moment she points at one problem.' },
                { id: 'c1c', text: '“Maybe fractions just aren’t your thing yet. Let me get you a simpler worksheet to build confidence.”',
                  scores: { mindset: -2, scaffold: -1 },
                  reply: 'Maria looks relieved, then deflated. She points at one problem on the original page.' },
                { id: 'c1d', text: '“Maria, we don’t push papers in this class. Pick it up and keep working, please.”',
                  scores: { mindset: -1 },
                  reply: 'Maria pulls the paper back without looking at you, then points at one problem.' }
              ] },
            { type: 'say', who: 'Maria',
              text: 'See? 3⁄4 plus 2⁄5. I did it like you showed us and it’s STILL wrong.',
              note: 'Her paper reads 3⁄4 + 2⁄5 = 5⁄9.' },
            { type: 'choice', id: 'c2', label: 'What’s your math move?',
              options: [
                { id: 'c2a', text: 'Ask her what 3⁄4 + 2⁄5 should be close to — get her estimating with benchmarks before touching the procedure.',
                  scores: { diagnose: 2, respond: 2 },
                  reply: 'Maria thinks. “Well… 3⁄4 is almost a whole one. So it should be more than 1? But 5⁄9 is… less than 1?” She frowns at her answer.' },
                { id: 'c2b', text: 'Walk her through the common-denominator steps again, slowly, while she watches.',
                  scores: { respond: 0 },
                  reply: 'Maria nods along. You’re not sure how much is landing.' },
                { id: 'c2c', text: 'Give her the right answer so she can move on to the next problem and rebuild confidence.',
                  scores: { respond: -1, mindset: -1 },
                  reply: 'Maria copies it down. “Okay. But I’m going to get the next one wrong too.”' },
                { id: 'c2d', text: 'Pair her with your strongest student so she can see how it’s done.',
                  scores: { respond: 0 },
                  reply: 'Maria slides her chair over, quiet. She watches more than she talks.' }
              ] },
            { type: 'free', id: 'a2q1', dim: 'mindset',
              who: 'Maria',
              text: 'But WHY is my way wrong? You add the tops, you add the bottoms. That makes sense.',
              label: 'What do you actually say to her? Type it the way you’d say it to a 12-year-old.',
              placeholder: 'Your actual words, not a description of your strategy.' },
            { type: 'say', who: 'After class',
              text: 'You check the exit tickets: 9 of your 24 students made the same add-across error.' },
            { type: 'choice', id: 'c3', label: 'Tomorrow you had planned to move on. What do you do?',
              options: [
                { id: 'c3a', text: 'Adjust tomorrow’s opening: an estimation warm-up built on the error, then regroup students using the exit-ticket data.',
                  scores: { respond: 2, scaffold: 1 } },
                { id: 'c3b', text: 'Move on as planned — the spiral review in two weeks will catch it.',
                  scores: { respond: -1 } },
                { id: 'c3c', text: 'Keep the whole class on this skill for another week until everyone has it.',
                  scores: { respond: 0 } },
                { id: 'c3d', text: 'Refer the 9 students to the intervention block to be re-taught there.',
                  scores: { scaffold: -1 } }
              ] }
          ]
        },
        {
          id: 'adapt',
          title: 'Adapt the plan',
          kicker: 'Act 3 of 3 · about 3 minutes',
          intro: 'Your co-teacher catches you after school: five of your 24 students have IEPs with goals around math computation, and tomorrow’s lesson is adding unlike fractions — the one you just rebuilt.',
          prompts: [
            { id: 'a3q1', dim: 'scaffold',
              label: 'What two changes do you make for tomorrow, and what stays the same for every student?',
              placeholder: 'Name the changes and — just as important — what you refuse to change.' }
          ]
        }
      ]
    }
  };

  // ---- v0 heuristic free-text scoring ----------------------------------
  // Transparent and deliberately simple: cue words + specificity. Returns a
  // delta in the same -2..+2 range as choice options so computeScores can
  // treat both signals uniformly. v1 replaces this function with an AI call.

  var CUES = {
    asset: ['understand', 'knows', 'can ', 'correctly', 'right idea', 'makes sense', 'strength', 'already', 'got the first', 'reasonable', 'logical'],
    deficit: ['low kid', 'low student', 'lazy', 'bad at math', 'just can’t', 'just cant', 'just can\'t', 'never get', 'not a math person', 'dumb', 'behind kids', 'slow kids'],
    math: ['denominator', 'numerator', 'equivalent', 'common denominator', 'unit', 'whole', 'benchmark', 'estimate', 'add across', 'adds across', 'across', 'part', 'size of the piece', 'fifths', 'fourths', 'number line'],
    respond: ['ask', 'estimate', 'benchmark', 'number line', 'show me', 'explain to me', 'notice', 'wonder', 'draw', 'model', 'what do you think', 'tell me', 'walk me through'],
    scaffold: ['manipulative', 'number line', 'visual', 'model', 'sentence frame', 'chunk', 'small group', 'check in', 'exit ticket', 'fraction tiles', 'fraction bars', 'graphic organizer', 'pre-teach', 'preteach', 'extra time', 'co-teach', 'station'],
    holdBar: ['same goal', 'same standard', 'same problem', 'same target', 'stays the same', 'still expect', 'high expectation', 'grade-level', 'grade level', 'everyone', 'all students', 'not water', 'don’t lower', 'dont lower', 'don\'t lower']
  };

  function countCues(text, list) {
    var t = ' ' + String(text || '').toLowerCase() + ' ';
    var n = 0;
    for (var i = 0; i < list.length; i++) { if (t.indexOf(list[i]) !== -1) n++; }
    return n;
  }

  function wordCount(text) {
    var words = String(text || '').trim().split(/\s+/).filter(Boolean);
    return words.length;
  }

  function scoreFreeText(text, dim) {
    var words = wordCount(text);
    if (words < 5) return { delta: -2, flags: ['Response of fewer than 5 words — little signal.'] };
    var delta = 0;
    var flags = [];
    if (words >= 30) delta += 1; // enough room for specificity

    var deficitHits = countCues(text, CUES.deficit);
    if (deficitHits > 0) {
      delta -= 2;
      flags.push('Deficit framing detected — review the verbatim response.');
    }

    if (dim === 'diagnose') {
      if (countCues(text, CUES.math) >= 2) delta += 1;
      if (countCues(text, CUES.asset) >= 1) delta += 1;
    } else if (dim === 'mindset') {
      if (countCues(text, CUES.asset) >= 1) delta += 1;
      if (countCues(text, CUES.math) >= 1) delta += 1; // explains the math, not just soothes
    } else if (dim === 'respond') {
      if (countCues(text, CUES.respond) >= 1) delta += 1;
      if (countCues(text, CUES.math) >= 1) delta += 1;
    } else if (dim === 'scaffold') {
      if (countCues(text, CUES.scaffold) >= 1) delta += 1;
      if (countCues(text, CUES.holdBar) >= 1) delta += 1;
    }
    if (delta > 2) delta = 2;
    if (delta < -2) delta = -2;
    return { delta: delta, flags: flags };
  }

  // ---- Aggregate scoring -------------------------------------------------
  // responses: { promptId: text }, choices: { choiceId: optionId },
  // timings: { actId: seconds }. Each dimension starts at a neutral 2 and
  // moves with the average of its signals, clamped to 1..4.

  function findOption(pack, choiceId, optionId) {
    for (var a = 0; a < pack.acts.length; a++) {
      var steps = pack.acts[a].steps || [];
      for (var s = 0; s < steps.length; s++) {
        if (steps[s].type === 'choice' && steps[s].id === choiceId) {
          for (var o = 0; o < steps[s].options.length; o++) {
            if (steps[s].options[o].id === optionId) return steps[s].options[o];
          }
        }
      }
    }
    return null;
  }

  function allPrompts(pack) {
    var out = [];
    pack.acts.forEach(function (act) {
      (act.prompts || []).forEach(function (p) { out.push(p); });
      (act.steps || []).forEach(function (st) {
        if (st.type === 'free') out.push({ id: st.id, dim: st.dim, label: st.label });
      });
    });
    return out;
  }

  function computeScores(pack, responses, choices) {
    var signals = { diagnose: [], mindset: [], respond: [], scaffold: [] };
    var evidence = { diagnose: [], mindset: [], respond: [], scaffold: [] };
    var flags = [];

    allPrompts(pack).forEach(function (p) {
      var text = responses[p.id] || '';
      var r = scoreFreeText(text, p.dim);
      signals[p.dim].push(r.delta);
      flags = flags.concat(r.flags.map(function (f) { return f + ' (“' + p.label + '”)'; }));
      evidence[p.dim].push({ source: p.label, quote: text || '(no response)' });
    });

    Object.keys(choices).forEach(function (choiceId) {
      var opt = findOption(pack, choiceId, choices[choiceId]);
      if (!opt) return;
      Object.keys(opt.scores || {}).forEach(function (dim) {
        signals[dim].push(opt.scores[dim]);
        evidence[dim].push({ source: 'Chose: ', quote: opt.text });
      });
    });

    var dims = {};
    Object.keys(signals).forEach(function (dim) {
      var arr = signals[dim];
      var avg = arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : 0;
      var score = Math.round(2 + avg); // neutral 2, signals move it within 1..4
      if (score < 1) score = 1;
      if (score > 4) score = 4;
      dims[dim] = score;
    });

    return { dims: dims, evidence: evidence, flags: flags };
  }

  // Interview follow-ups are generated from the candidate's weakest dimensions
  // so the principal walks into the screen with questions, not homework.
  var FOLLOW_UPS = {
    diagnose: 'Bring a second piece of student work to the interview and ask them to think aloud: “What does this student understand?”',
    mindset: 'Ask: “Tell me about a student you initially misjudged. What changed your read?”',
    respond: 'Ask: “Your re-teach didn’t land for a third of the class. What’s your next move — specifically?”',
    scaffold: 'Ask: “Walk me through how you’d keep an IEP student on the grade-level goal in this exact lesson.”'
  };

  function followUps(dims) {
    return Object.keys(dims)
      .filter(function (d) { return dims[d] <= 2; })
      .map(function (d) { return { dim: d, question: FOLLOW_UPS[d] }; });
  }

  function buildPayload(pack, state) {
    var scored = computeScores(pack, state.responses, state.choices);
    return {
      version: 'sim-v0',
      pack: pack.id,
      roleLabel: pack.roleLabel,
      candidate: state.candidate || {},
      responses: state.responses,
      choices: state.choices,
      timings: state.timings || {},
      totalSeconds: Object.keys(state.timings || {}).reduce(function (a, k) { return a + state.timings[k]; }, 0),
      scores: scored.dims,
      evidence: scored.evidence,
      flags: scored.flags,
      followUps: followUps(scored.dims),
      submittedAt: new Date().toISOString()
    };
  }

  return {
    DIMS: DIMS,
    PACKS: PACKS,
    scoreFreeText: scoreFreeText,
    computeScores: computeScores,
    followUps: followUps,
    buildPayload: buildPayload,
    allPrompts: allPrompts,
    findOption: findOption
  };
});
