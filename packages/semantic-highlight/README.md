# Semantic highlights

One DSH plugin (`dsh-semantic-highlight`) that lets the model mark what matters in a reply and shows the marks as highlighter strokes in the Web GUI.

## Markers

The model writes an ordinary Markdown link whose destination names the meaning; the GUI colors the link text.

| Marker | Meaning | Rendering |
| --- | --- | --- |
| `[text](hl:key)` | Conclusion, figure, or condition to retain | Yellow highlight |
| `[text](hl:risk)` | Risk, irreversible action, blocker, urgent item | Red highlight with a red bottom edge |
| `[text](hl:head)` | Recommended approach, priority action, solution, key step, or essential section label | Green highlight |
| `[text](hl:note)` | Qualifier that changes a sentence's meaning | Underline |

Red, green, and the underline use the theme's error, success, and brand tokens. Yellow mixes the warning token with a literal yellow, because the theme has no yellow. Highlights use inline padding and background only; font size, weight, and line height stay unchanged. Forced-colors mode uses the system `Mark` colors, with a wavy underline for risk. Destinations match case-insensitively.

## Selection policy

Use both levels by default in substantive explanations, comparisons, recommendations, and reports: keyword/data highlights for scanning plus whole-sentence highlights for the most important conclusions or recommendations. Sentence highlights supplement rather than replace short marks. There is no combined count limit across yellow, green, red, and underline, nor any per-style count limit. Keyword/data and whole-sentence highlights have no numeric caps, count quotas, or length-based count ranges. Select by information value and readability; do not suppress useful highlights merely because other styles have already been used. Keep most text unmarked rather than coloring everything mechanically. A long sentence may use its decisive clause instead. Keep units and essential conditions attached, do not nest short marks inside sentence highlights, and do not re-highlight the same information elsewhere. The prompt checks both levels separately: a lone mark is insufficient for a multi-paragraph answer with several useful points, and missing sentence or keyword highlights should be added. Highlights require explicit markers; ordinary bold is not automatically recolored. Bold and highlights may overlap in any color: use `[**text**](hl:key)` for bold yellow text, or emphasize only part of a highlighted sentence with `**...**`. Combining bold and color counts as one highlight. Do not make every highlight bold automatically.

Green means what to do: a recommended approach or configuration, next troubleshooting action, concrete solution, essential procedural step, or key section label. Yellow means what to remember: a conclusion, fact, figure, or condition. Mark the highest-priority concrete recommendation in green when actionable advice exists. Prefer green when a recommendation could fit either; do not mark it twice or force green into purely descriptive answers. The existing `hl:head` destination remains compatible.

Greetings, acknowledgments, simple factual answers without consequential qualifiers, verbatim quotations, exact-format output, and requests for plain text or no highlighting may remain unmarked. A short warning can still merit a mark. No risk or filler should be invented to meet a count; the surface exclusions and readability guidance still apply.

## Setting

Plugins → Semantic highlights shows one switch, **Highlight replies** (default on), above a legend of the four marks. Off empties the prompt paragraph from the next model step, so the model stops writing markers, and shows existing markers as plain text. The switch writes the row's `enabled` field in the profile; no restart is needed.

Disabling the whole plugin instead also unloads the stylesheet, so existing markers then render as ordinary links.

## Architecture

- `src/prompt.js`: the model-facing contract (surface condition, marker names, how much to mark, where never to mark).
- `src/host.js`: the volatile `enabled` setting and one `systemPrompt` section whose text is empty while the switch is off.
- `src/client.js`: one stylesheet in `shell.overlay`, a capture guard that keeps `hl:` links from navigating or being dragged, and the switch row in `plugins.bundle.config`. The switch and the stylesheet read the setting through `configForms`; without that service highlights stay on and no switch is shown.

The plugin replaces no renderer and rewrites no message DOM: the host Markdown renderer already turns these links into `<a href="hl:…">`, during streaming as well, and the stylesheet matches that attribute. No polling, mutation observer, or timer is added.

## Limitations

- A highlight appears when its link closes. While the marked phrase is still streaming, the text shows with a leading `[`, and the destination may flash briefly before the stroke replaces it. The prompt keeps marks short to shorten this.
- A mark stays an anchor. It is a keyboard tab stop that does nothing on Enter, a screen reader announces it as a link without its category, and a browser context menu still offers to open it. Removing these needs changes to rendered message DOM, which this plugin does not make.
- Outside the Web GUI, a marker is a link to `hl:…`: the message copy action and Markdown exports carry it. The prompt tells subagents and agents whose output goes to IM, another agent, a program, or a file to write no markers; compliance depends on the model.
- Copying a selection of rendered text pastes as the words alone into plain-text targets; rich-text targets receive the anchor.
- Whether and how often markers appear depends on the model following the prompt paragraph, which is added to every agent's system prompt in the profile.
- Developed against DSH `0.2.2-rc.5`. The stylesheet relies on the renderer emitting the link destination as `href` and the link glyph as a direct `svg` child.

## Validation

```sh
node --test test/*.test.js
```

The Host tests use the declared Schemastery dependency and do not skip when it is missing. Run `npm ci --ignore-scripts` at the repository root before testing. Prompt tests protect the positive selection rule, zero-marker self-check, exclusions, and absence of numeric count caps; they check the contract, not model compliance.

After reloading the Host plugin (or restarting DSH if module changes are not reloaded), validate in a fresh Web GUI turn:

- Ask for a Redis RDB/AOF production comparison: for a multi-paragraph answer, expect meaningful key-term/data highlights alongside important whole-sentence highlights, without numeric count targets; mark the highest-priority concrete recommendation in green.
- Ask for a recommended configuration, next troubleshooting action, or procedural solution: green should apply in prose without requiring headings; sentence-level highlights coexist with useful keyword/data marks without a combined count limit.
- Ask whether a destructive operation is reversible: even a brief warning should get an appropriate mark.
- Send a simple acknowledgment, request exact JSON, or explicitly request no highlights: zero marks are appropriate.
- Turn Highlight replies off and repeat: no new markers should be requested; existing markers should lose color.

Repeat substantive prompts across fresh conversations to evaluate omission rate and over-highlighting; static tests cannot guarantee that every model reply follows the policy. Changing the prompt does not add markers retroactively to existing messages. Reload the Host plugin to pick up prompt changes; refreshing the browser alone does not reload Host-side JavaScript. This package ships its client entry directly as `src/client.js`; after client legend changes, reload the client plugin and refresh the existing GUI to verify the labels. Do not assume a development watcher or automatic hot reload is running.

## Installation and migration

Build an independent archive with `npm run pack:plugins` at the repository root, then install the generated `dsh-semantic-highlight-1.0.0.tgz` through the DSH plugin manager. This package has not been published to npm.

Disable and remove the local `@local/semantic-highlight` predecessor before enabling this edition. Do not run both editions together: they style the same markers and inject overlapping guidance. The package and configuration entry IDs changed; reapply the Highlight replies setting if necessary. Installing this package does not migrate the local source or profile automatically.
