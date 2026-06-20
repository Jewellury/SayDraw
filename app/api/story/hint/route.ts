export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { generateStoryFrame, NoApiKeyError } from '@/lib/ai/provider';
import { HINT_SYS, HINT_SYS_EN } from '@/lib/ai/prompts';
import { getMockHint } from '@/lib/ai/mock';
import type { HintRequest, HintResponse, GenerateError } from '@/lib/story/types';

function parseHintResponse(raw: string): string {
  try {
    const o = JSON.parse(raw);
    if (typeof o.hint === 'string' && o.hint.trim()) {
      return o.hint.trim();
    }
    return '';
  } catch {
    console.error('[parseHint] JSON parse failed, raw length:', raw.length, raw.slice(0, 200));
    return '';
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: HintRequest = await req.json();
    const { storySoFar, lang } = body;

    const systemPrompt = lang === 'en' ? HINT_SYS_EN : HINT_SYS;

    const userMessage =
      lang === 'en'
        ? 'Story so far:\n' + (storySoFar || '') + '\n\nGive a short inspiration hint to help the child continue the story.'
        : '故事进行到：\n' + (storySoFar || '') + '\n\n请给一个灵感提示，帮助孩子继续编故事。';

    let hint: string;

    try {
      const raw = await generateStoryFrame(systemPrompt, userMessage);
      hint = parseHintResponse(raw);
      if (!hint) hint = getMockHint(lang);
    } catch (e) {
      if (!(e instanceof NoApiKeyError)) {
        console.error('[api/story/hint]', (e as Error).message);
      }
      hint = getMockHint(lang);
    }

    const res: HintResponse = { hint };
    return NextResponse.json(res);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[api/story/hint]', message);
    const err: GenerateError = { error: '获取提示失败，请再试一次' };
    return NextResponse.json(err, { status: 500 });
  }
}
