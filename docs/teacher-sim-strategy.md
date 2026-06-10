# Teacher Sim — Prototype Strategy

*Prototype lives at `sparklps/sim/` (candidate experience) and `sparklps/sim/review.html`
(principal evidence pack). This doc is the why and the what-next.*

## Why a sim, and why this one

Packet's three goals: cut screening time in half, surface real fit signal that resumes
and Q&A interviews can't, and keep more candidates moving through the funnel. Today's
research pointed at the same conclusion from three directions:

- **Principals already believe in sims.** Mustafa's #1 pick for "what would actually
  change hiring" was a teaching simulation — interviews reward polish; he wants to see
  *real thinking* and *mindset toward students* before scheduling a demo lesson.
- **Context is the failure mode of generic sims.** Will's feedback: a sim that isn't
  subject- and grade-specific reads as a personality quiz, and every minute of friction
  (logins, video uploads) costs completions — video is both a funnel-killer and a
  privacy problem for districts.
- **"Assess better" is the lever we can win.** Of the value levers (source more, move
  faster, assess better, close better), assessment quality is where the existing
  workshop-hiring base plus AI gives us a credible, defensible edge.

## Design principles (each one traces to a research finding)

1. **10–12 minutes, no login, no video, works on a phone.** Friction kills the funnel;
   no recording sidesteps district privacy review for a pilot.
2. **Authentic artifacts, not quiz questions.** The candidate reads real (synthetic but
   realistic) student work containing a genuine misconception, handles a live classroom
   moment, and adapts a lesson plan. You cannot answer these well from a script.
3. **Subject- and grade-specific.** The prototype ships one scenario pack — middle-school
   math, matched to Spark's open Math/SPED role — with the pack structure designed so
   science/history packs are data, not code.
4. **Typed voice over multiple choice where it matters.** Choice points give clean,
   comparable signal; the "what do you actually say to her?" free responses give the
   un-fakeable signal. Both feed the rubric.
5. **The candidate gets value too.** The sim *shows* what Spark believes about teaching
   (growth mindset, high expectations, responsive instruction). Strong candidates should
   finish thinking "I want to work somewhere that asks questions like this."
6. **AI does legwork, humans decide.** The output is an evidence pack — scores *with the
   verbatim evidence underneath* plus suggested interview follow-ups — never a
   hire/reject verdict.

## The sim (math pack, ~11 min)

| Act | Format | What it surfaces |
|-----|--------|------------------|
| 1. Read the student's thinking (~3 min) | Jayden's worked fraction problems (one right, two wrong via add-across misconception) + two typed responses | Diagnostic skill; asset vs deficit framing |
| 2. The moment (~5 min) | Chat-style scene: Maria says "I'm just bad at math." Three choice points + one typed "say it as you'd say it" response | Mindset & expectations; responsive instruction; use of data |
| 3. Adapt (~3 min) | Co-teacher flags 5 students with IEPs for tomorrow's lesson; typed plan | Inclusive scaffolding without lowering the bar |

Identity (name/email) is collected at the **end**, after investment, not as a gate.

## Rubric (1–4 per dimension)

1. **Diagnosing student thinking** — names what the student *can* do and the precise
   misconception, not just "they got it wrong."
2. **Mindset & expectations** — asset framing, normalizes struggle, holds the bar.
3. **Responsive instruction** — next move responds to *this* student's thinking
   (estimation, benchmarks, student talk) rather than re-explaining the procedure.
4. **Inclusive scaffolding** — adapts access (models, manipulatives, grouping) while
   keeping the goal constant for every student.

## Scoring: v0 heuristic → v1 AI

**v0 (this prototype):** choice points carry hand-assigned dimension deltas; free text is
scored by transparent keyword/feature heuristics in `sparklps/assets/sim.js`
(`scoreFreeText`). Good enough to demo the evidence pack end to end; not good enough to
rank candidates. The evidence pack labels it as such.

**v1 (implemented):** `netlify/functions/score-sim.mjs` scores the full attempt with
Claude (Opus 4.8, adaptive thinking, structured output): system = rubric + level
anchors, user = the candidate's verbatim responses + choice path + artifact context;
output = per-dimension scores, verbatim justifying quotes with rationale, flags, and
interview follow-ups built from the candidate's own words. The client treats it as
best-effort with a 12s timeout — if the function is unreachable or `ANTHROPIC_API_KEY`
isn't set on the Netlify site, the v0 heuristic scores stand and the candidate is never
blocked. The evidence pack labels which scorer produced it. Next refinement: collect
anchor responses from Spark's own strong teachers and fold them into the system prompt.

**Anti-gaming posture:** per-act timing is recorded (pasted-in AI answers at 40 wpm look
different from typed-at-speed answers); follow-up interview questions are generated from
the candidate's own responses, so outsourced answers create an interview liability; and
the rubric rewards specificity about *this* student, which generic AI output lacks.

## Funnel placement & data flow

- Linked from the role page after apply ("Already applied? Take the 10-minute classroom
  sim.") and from the post-application email.
- Submission rides the existing Netlify form infrastructure (`spark-sim` form), same as
  the apply form — no new backend for the pilot. Evidence pack renders client-side from
  the submission payload.
- No audio/video, no student PII (all student work is synthetic), candidate data goes
  only to the school, consistent with the existing privacy notice.

## Success metrics for the pilot

- **Completion rate ≥ 70%** of candidates who start (friction check).
- **Principal screen time per candidate cut ~50%** (evidence pack vs full resume+essay read).
- **Signal check:** principals rank 5 evidence packs blind; compare with post-demo-lesson
  rankings. The sim earns its place if it predicts the demo lesson.
- **Candidate sentiment:** one-question exit pulse ("This gave me a fair chance to show
  how I teach" — agree ≥ 80%).

## Out of scope for the prototype (deliberately)

Multi-pack content (science/history), AI scoring, ATS integration, proctoring, and any
candidate-facing score display. The prototype's job is to make the candidate experience
and the evidence pack real enough to put in front of Mustafa and two more principals.
