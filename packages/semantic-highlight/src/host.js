// Host half: owns the switch and tells the model how to mark highlights.
import z from '@deepseek-ai/schemastery';
import {highlightSection} from './prompt.js';

export const name = 'semantic-highlight';

export const inject = ['systemPrompt'];

// Volatile: the Host serves only volatile fields to the browser, and a change
// updates this reference in place instead of restarting the entry.
export const Config = z.object({
  enabled: z.boolean().default(true).volatile().description(
    'Ask the model to mark key points and render the marks in color.',
  ),
});

/**
 * Register the marker guidance for every agent of this profile.
 * @param ctx - context carrying the prompt registry.
 * @param config - validated row config with volatile references.
 */
export function apply(ctx, config) {
  // The section stays registered; its text is empty while the switch is off.
  // The registry ties it to this context and removes it on unload.
  ctx.systemPrompt.section(highlightSection(() => config?.enabled?.get() !== false));
}
