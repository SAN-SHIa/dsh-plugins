import z from '@deepseek-ai/schemastery';
import {createTurnGate} from './turn-gate.js';
import {datedTitle, generateTopic, selectMessages} from './topic.js';

export const inject = ['sessionTitle', 'llm'];
export const Config = z.object({
  timeZone: z.string().default('Asia/Shanghai'),
  maxInputCharacters: z.number().step(1).min(256).max(16000).default(6000),
  maxTopicCharacters: z.number().step(1).min(8).max(32).default(32),
  timeoutMs: z.number().step(1).min(1000).max(120000).default(30000),
});

export function apply(ctx, config) {
  // Validate the IANA zone at activation rather than failing on the first title.
  new Intl.DateTimeFormat('en-US', {timeZone: config.timeZone}).format();
  const waitForTurnEnd = createTurnGate(ctx);
  ctx.effect(() => ctx.sessionTitle.register({
    id: 'sanshi-session-auto-name',
    automatic: 'all-prompts',
    async generate(request) {
      if (request.session.header.origin === 'subagent') throw new Error('Subagent titles are excluded');
      const time = await waitForTurnEnd(request.session, request.signal);
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(config.timeoutMs)]);
      const messages = selectMessages(request.messages, config.maxInputCharacters);
      if (!messages.length || !request.route) throw new Error('No eligible human messages or model route');
      const topic = await generateTopic(ctx.llm, request.route, messages,
        request.currentTitle?.title, signal, request.session.id, config.maxTopicCharacters);
      return {
        title: datedTitle(topic, time, config.timeZone),
        messageSeqs: messages.map(message => message.seq),
        model: request.route,
      };
    },
  }));
}
