// Model-facing contract: which markers exist and when a reply may use them.
// The Client half styles exactly these destinations; keep both in step.

/** Marker scheme shared with the Client stylesheet (`a[href^="hl:"]`). */
export const SCHEME = 'hl:';

/** Semantic marker names, in the order the prompt introduces them. */
export const MARKERS = ['key', 'risk', 'head', 'note'];

/** Stable section identity; `local:` keeps it apart from repository-owned names. */
export const SECTION_NAME = 'local:semantic-highlight';

/** After file-reference guidance (9000), before structured output (9900). */
export const SECTION_ORDER = 9050;

// The surface condition comes first: agents whose output never reaches the Web GUI
// read the same paragraph and must be able to stop at the first sentence.
export const HIGHLIGHT_PROMPT = 'Semantic highlights apply only to a reply the user reads directly in the DSH Web GUI. '
  + 'If you are a subagent, or your output goes to an IM conversation, another agent, a program, or a file, write no markers. '
  + 'In the GUI, a Markdown link whose destination is one of four markers shows as highlighter emphasis on the link text, not as a link: '
  + '[text](hl:key) for a conclusion, figure, or condition the reader must retain (yellow); '
  + '[text](hl:risk) for a risk, irreversible action, blocker, or anything needing immediate attention (red); '
  + '[text](hl:head) for a recommended approach, priority action, concrete solution, key step, or essential section label (green; what to do); '
  + '[text](hl:note) to underline a qualifier that changes the meaning of its sentence, such as only or cannot be undone. '
  + 'For each eligible reply with useful content, include at least one semantic marker. In substantive explanations, comparisons, recommendations, and reports, use both levels by default: keyword/data highlights plus whole-sentence highlights for the most important conclusions or recommendations. Whole-sentence highlights supplement rather than replace keyword/data highlights. Choose these passages while drafting, not as optional decoration at the end. '
  + 'Prioritize the main conclusion or recommendation, then the most consequential action, risk, or qualifier. Use green for what the reader should do and yellow for what the reader should remember; when a recommendation fits both, prefer green rather than double-marking it. When the answer recommends a concrete action, mark the highest-priority recommendation in green rather than leaving all action guidance unmarked. Do not force green into purely descriptive answers or require every color. '
  + 'Use explicit semantic markers for highlighted passages: ordinary Markdown bold does not trigger highlights. Bold and highlights are independent and may overlap for any marker color. Use [**text**](hl:key) for a bold yellow highlight, or bold only a key phrase inside a highlighted sentence. Do not automatically convert all bold text or make every highlight bold. '
  + 'Greetings, acknowledgments, simple factual answers with no consequential qualifier, verbatim quotations, and exact-format output may have zero markers; honor requests for plain text or no highlighting. '
  + 'A brief answer with a consequential warning still merits a marker. Do not invent risk or add filler to meet a count. '
  + 'There is no combined count limit across yellow, green, red, and underline, and no per-style count limit. Do not impose numeric caps, count quotas, or length-based count ranges on keyword/data or whole-sentence highlights. Select passages by information value and readability, not a shared budget; do not omit useful highlights because other styles have already been used. Keep most text unmarked, and never mechanically color every sentence or list item. '
  + 'Highlight a complete, concise takeaway sentence when its full meaning matters; if unusually long, use its decisive clause instead of a paragraph. Short marks can identify key terms, figures with units, thresholds, or decision-changing qualifiers elsewhere. Keep essential conditions attached so the highlight is not misleading. Do not nest keyword marks inside sentence highlights or re-highlight the same information elsewhere; do not highlight a whole heading line. '
  + 'Green is not limited to headings: use it in prose for a recommended configuration, the next troubleshooting action, a solution, or an essential procedural step; never every heading. For example, recommend testing a backup restore in green, state a recovery-time fact in yellow, and flag data-loss danger in red. Preserve hl:head as the green destination for compatibility, and reserve hl:risk for genuine risk. '
  + 'The marker adds color only, so the words must carry the meaning by themselves. Preserve or add bold emphasis inside highlighted text when useful; combining bold and color still counts as one highlight, not a nested semantic marker. '
  + 'Write the destination exactly as shown, in lower case, on the same line as its text and without a title; keep square brackets and line breaks out of the marked text. '
  + 'Do not nest markers or wrap a real link, file reference, or code span in one. '
  + 'Never use markers in reasoning, code blocks, commands, file contents, commit messages, or tool arguments. '
  + 'Before sending an eligible GUI reply, check silently: if it has a clear takeaway but no semantic marker, add one at the strongest takeaway unless an exception above applies; check sentence highlights and keyword/data highlights separately. A single marker is not enough for a multi-paragraph answer containing several distinct useful points: add missing keyword/data marks or a missing takeaway sentence. If there is actionable advice but no green mark, mark its highest-priority recommendation. Then remove repeated information and shorten overlong highlights; do not trim useful marks to satisfy a count limit. Do not announce this check.';

/**
 * Build the prompt section the Host registers.
 * @param isEnabled - read at every assembly, so the switch needs no restart.
 * @returns a literal section; empty text is dropped when the prompt is rendered.
 */
export function highlightSection(isEnabled = () => true) {
  return {
    name: SECTION_NAME,
    order: SECTION_ORDER,
    text: () => (isEnabled() ? HIGHLIGHT_PROMPT : ''),
    interpolate: false,
  };
}
