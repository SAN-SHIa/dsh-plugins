import z from '@deepseek-ai/schemastery';

export const Config = z.object({
  typographySessions: z.boolean().default(true).volatile().description('PingFang SC session titles and Command + 1/2/3 navigation'),
  sidebarGlass: z.boolean().default(true).volatile().description('Reveal native macOS sidebar vibrancy'),
  fileTooltips: z.boolean().default(true).volatile().description('Show local file paths on hover'),
  closePriority: z.boolean().default(true).volatile().description('Close the right sidebar page before the desktop window'),
  sidechatShortcut: z.boolean().default(true).volatile().description('Command + Option + S opens Side Chat when available'),
});

export function apply() {}
