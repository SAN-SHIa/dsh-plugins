import assert from 'node:assert/strict';
import test from 'node:test';
import {HIGHLIGHT_PROMPT, MARKERS, SCHEME, SECTION_NAME, SECTION_ORDER, highlightSection} from '../src/prompt.js';

test('prompt introduces every marker with its exact destination', () => {
  assert.deepEqual(MARKERS, ['key', 'risk', 'head', 'note']);
  for (const marker of MARKERS) assert.ok(HIGHLIGHT_PROMPT.includes(`[text](${SCHEME}${marker})`), marker);
});

test('prompt states the surface condition before it teaches any marker', () => {
  const firstMarker = HIGHLIGHT_PROMPT.indexOf('[text](');
  for (const phrase of ['only to a reply the user reads directly in the DSH Web GUI', 'subagent', 'IM conversation', 'another agent', 'write no markers']) {
    const at = HIGHLIGHT_PROMPT.indexOf(phrase);
    assert.ok(at >= 0 && at < firstMarker, phrase);
  }
});

test('prompt limits how much is marked and where', () => {
  for (const phrase of [
    'Keep most text unmarked', 'never every heading',
    'reserve hl:risk for genuine risk', 'in lower case',
    'reasoning', 'code blocks', 'commit messages', 'tool arguments',
  ]) {
    assert.ok(HIGHLIGHT_PROMPT.includes(phrase), phrase);
  }
});

test('substantive replies have a positive selection rule, not just a maximum', () => {
  for (const phrase of [
    'For each eligible reply with useful content',
    'plus whole-sentence highlights', 'include at least one semantic marker',
    'Use explicit semantic markers for highlighted passages',
    'Do not automatically convert all bold text',
  ]) assert.ok(HIGHLIGHT_PROMPT.includes(phrase), phrase);
  assert.ok(!HIGHLIGHT_PROMPT.includes('a short reply usually needs none'));
});

test('self-check catches unmarked takeaways without forcing decorative highlights', () => {
  for (const phrase of [
    'Before sending', 'no semantic marker', 'add one at the strongest takeaway',
    'A brief answer with a consequential warning still merits a marker',
    'Greetings, acknowledgments, simple factual answers with no consequential qualifier',
    'verbatim quotations, and exact-format output may have zero markers',
    'Do not invent risk or add filler', 'Do not announce this check',
  ]) assert.ok(HIGHLIGHT_PROMPT.includes(phrase), phrase);
});

test('keyword/data and sentence highlights coexist without a shared budget', () => {
  for (const phrase of [
    'Whole-sentence highlights supplement rather than replace keyword/data highlights',
    'use both levels by default',
    'check sentence highlights and keyword/data highlights separately',
    'complete, concise takeaway sentence',
    'figures with units', 'Keep essential conditions attached',
    'Do not nest keyword marks inside sentence highlights',
    're-highlight the same information elsewhere',
  ]) assert.ok(HIGHLIGHT_PROMPT.includes(phrase), phrase);
  for (const obsolete of [
    'at most two marked spans in the entire reply',
    'do not scatter marks over isolated keywords',
    'keep only the one or two highest-value marked passages',
    'never a whole sentence', 'ten CJK characters',
  ]) assert.ok(!HIGHLIGHT_PROMPT.includes(obsolete), obsolete);
});

test('green covers actionable prose without forcing color quotas', () => {
  for (const phrase of [
    'recommended approach, priority action, concrete solution, key step',
    'Green is not limited to headings', 'recommended configuration',
    'next troubleshooting action', 'essential procedural step',
    'prefer green rather than double-marking it', 'Do not force green into purely descriptive answers',
    'Preserve hl:head as the green destination for compatibility',
  ]) assert.ok(HIGHLIGHT_PROMPT.includes(phrase), phrase);
});

test('value-based selection and self-check do not impose numeric count limits', () => {
  for (const phrase of [
    'Choose these passages while drafting',
    'There is no combined count limit across yellow, green, red, and underline',
    'no per-style count limit',
    'Do not impose numeric caps, count quotas, or length-based count ranges',
    'do not omit useful highlights because other styles have already been used',
    'do not trim useful marks to satisfy a count limit',
    'A single marker is not enough for a multi-paragraph answer',
    'add missing keyword/data marks or a missing takeaway sentence',
    'If there is actionable advice but no green mark',
  ]) assert.ok(HIGHLIGHT_PROMPT.includes(phrase), phrase);
  for (const obsolete of ['most paragraphs need none', 'highlights are welcome', 'when warranted', 'do not force both levels', 'at most two', 'sentence budget', '1-2', '3-5', '4-6']) {
    assert.ok(!HIGHLIGHT_PROMPT.includes(obsolete), obsolete);
  }
});

test('bold can overlap any highlight without automatic recoloring or forced weight', () => {
  for (const phrase of [
    'Bold and highlights are independent and may overlap for any marker color',
    '[**text**](hl:key)', 'bold only a key phrase inside a highlighted sentence',
    'Do not automatically convert all bold text or make every highlight bold',
    'combining bold and color still counts as one highlight',
  ]) assert.ok(HIGHLIGHT_PROMPT.includes(phrase), phrase);
  for (const obsolete of ['do not also bold a marked phrase', 'Use semantic markers instead of bold']) {
    assert.ok(!HIGHLIGHT_PROMPT.includes(obsolete), obsolete);
  }
});

test('section is literal, named for this plugin, and placed after file-reference guidance', () => {
  const section = highlightSection();
  assert.equal(section.name, SECTION_NAME);
  assert.equal(section.order, SECTION_ORDER);
  assert.ok(section.order > 9000 && section.order < 9900);
  assert.equal(section.interpolate, false);
  // Interpolation is off, yet the text must not look like a variable reference either.
  assert.ok(!HIGHLIGHT_PROMPT.includes('{{'));
});

test('section text follows the switch at every assembly', () => {
  let enabled = true;
  const section = highlightSection(() => enabled);
  assert.equal(section.text(), HIGHLIGHT_PROMPT);
  enabled = false;
  // Empty text is dropped when the prompt is rendered.
  assert.equal(section.text(), '');
  enabled = true;
  assert.equal(section.text(), HIGHLIGHT_PROMPT);
  assert.equal(highlightSection().text(), HIGHLIGHT_PROMPT);
});
