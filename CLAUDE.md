# CLAUDE.md

## Writing style

These rules govern every word produced in this repo: page copy, headings, alt
text, meta descriptions, commit messages, PR titles and bodies, code comments,
and chat replies. They are not stylistic preferences to weigh against other
goals. Apply them first, before anything else about tone or format.

### Rules

- No antithesis.
- No corrective negation.
- No paragraph pinning.
- No parataxis.
- No summary beats.
- No rhetorical crutches.
- No negative parallelisms.
- No negative anaphoras.
- No contrasting pairs.
- No rule of three.
- No em dashes.
- No throat-clearing openers.
- No landing sentences.
- No setup/payoff constructions.
- No parallel sentence structures within a paragraph.
- Vary sentence length unpredictably.
- No stacked noun phrases.
- No filler intensifiers (genuinely, really, truly, actually).
- No corporate-register verbs (leverage, underscore, reflect).
- No nominalization.
- No hedging qualifiers.
- Write for the spoken voice.
- No performed enthusiasm.

### What the rules rule out

Some of the terms above name patterns that are easy to write by accident. Short
gloss on each:

- **Antithesis**: setting two ideas against each other for effect. "The job is
  hard, the pay is fair."
- **Corrective negation**: saying what a thing is not before saying what it is.
  "It's not a startup, it's a school."
- **Paragraph pinning**: opening and closing a paragraph on the same phrase so
  it snaps shut.
- **Parataxis**: stacked short clauses with no connective tissue. "We hire
  fast. We pay on time. We answer email."
- **Summary beat**: a closing line that restates what the reader just read.
- **Negative parallelism / negative anaphora**: repeated "no X, no Y, no Z" or
  "not this, not that" shapes.
- **Contrasting pair**: any two-part construction whose point is the contrast.
- **Rule of three**: three items or three clauses in a row for rhythm.
- **Throat-clearing opener**: "In today's market," "When it comes to hiring,"
  "It's worth noting that."
- **Landing sentence**: a short punchy line placed to make the paragraph feel
  resolved.
- **Setup/payoff**: building a sentence so a later clause pays off an earlier
  one.
- **Stacked noun phrase**: "candidate experience optimization strategy."
- **Nominalization**: verbs turned into nouns. Write "we decided," not "the
  decision was made" or "our decision-making process."
- **Hedging qualifier**: "somewhat," "fairly," "arguably," "tends to,"
  "in most cases."

### How to check work before shipping it

Read the draft out loud. Anything that sounds like a speech, a slogan, or an
ad has a pattern in it that belongs on the list above. Sentence lengths should
look uneven on the page. If three sentences in a row share a shape, rewrite two
of them.

Job postings on this site describe real openings for real employers, so the
copy has to survive being read by a candidate who is skeptical of marketing
language. Plain sentences carry more weight than crafted ones here.

## Repository

Static site, no build step. HTML and assets are served as-is.

- `index.html` is the root page.
- `sparklps/` and `wcasd/` are per-employer sections. Each owns its own
  `assets/` with its own `styles.css` and `site.js`. Open roles live under
  `sparklps/roles/`.
- `privacy/` holds the privacy policy.
- Root `assets/` holds Workshop's own logos and favicons.
- `robots.txt` and `sitemap.xml` control crawling. New role pages need a
  sitemap entry. A page that is not ready for the public needs `noindex` until
  the employer signs off.
