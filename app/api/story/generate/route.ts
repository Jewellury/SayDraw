export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { generateStoryFrame, generateStoryFrameSemantic, NoApiKeyError } from '@/lib/ai/provider';
import { extractSvg } from '@/lib/ai/svg-model';
import { COMBINED_SYS, SEMANTIC_SYS } from '@/lib/ai/prompts';
import { getMockText } from '@/lib/ai/mock';
import { sanitizeSvg } from '@/lib/svg/sanitizeSvg';
import { renderScene } from '@/lib/svg/semanticRenderer';
import type { GenerateRequest, GenerateResponse, GenerateError } from '@/lib/story/types';

let mockCounter = 0;

const FALLBACK_SVG =
  '<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M120 180 q80 -90 160 0" fill="none" stroke="#211e18" stroke-width="3" stroke-linecap="round"/>' +
  '<circle cx="170" cy="150" r="6" fill="none" stroke="#211e18" stroke-width="2"/>' +
  '<circle cx="230" cy="150" r="6" fill="none" stroke="#211e18" stroke-width="2"/>' +
  '<path d="M170 175 q30 18 60 0" fill="none" stroke="#211e18" stroke-width="2" stroke-linecap="round"/>' +
  '</svg>';

function parseCombinedResponse(raw: string, fallbackNarration: string): {
  narration: string;
  followUpQuestion: string;
  storySummary: string;
  svg: string;
} {
  try {
    const o = JSON.parse(raw);
    return {
      narration: (typeof o.narration === 'string' && o.narration) || fallbackNarration,
      followUpQuestion: (typeof o.followUpQuestion === 'string' && o.followUpQuestion) || '',
      storySummary: (typeof o.storySummary === 'string' && o.storySummary) || '',
      svg: (typeof o.svg === 'string' && o.svg) || '',
    };
  } catch {
    console.error('[parseCombined] JSON parse failed, raw length:', raw.length, raw.slice(0, 200));
    return {
      narration: fallbackNarration,
      followUpQuestion: '',
      storySummary: '',
      svg: '',
    };
  }
}

function parseSemanticResponse(raw: string, fallbackNarration: string): {
  narration: string;
  followUpQuestion: string;
  storySummary: string;
  components: Array<{ id: string; role: string; drawOrder: number }>;
} {
  try {
    const o = JSON.parse(raw);
    return {
      narration: (typeof o.narration === 'string' && o.narration) || fallbackNarration,
      followUpQuestion: (typeof o.followUpQuestion === 'string' && o.followUpQuestion) || '',
      storySummary: (typeof o.storySummary === 'string' && o.storySummary) || '',
      components: Array.isArray(o.components) ? o.components : [],
    };
  } catch {
    console.error('[parseSemantic] JSON parse failed, raw length:', raw.length, raw.slice(0, 200));
    return {
      narration: fallbackNarration,
      followUpQuestion: '',
      storySummary: '',
      components: [],
    };
  }
}

function validateSvg(svg: string): string {
  const s = String(svg || '');
  if (!s || !s.includes('<svg') || !s.includes('</svg>')) {
    return '';
  }
  return s;
}

export async function POST(req: NextRequest) {
  try {
    const body: GenerateRequest = await req.json();
    const { storySoFar, newLine, speaker, textPrompt } = body;

    if (!newLine || !newLine.trim()) {
      const err: GenerateError = { error: '请说一句话再来画' };
      return NextResponse.json(err, { status: 400 });
    }

    const isSemantic = req.nextUrl.searchParams.get('strategy') === 'semantic';

    const systemPrompt = isSemantic ? SEMANTIC_SYS : (
      textPrompt && textPrompt.trim()
        ? `${COMBINED_SYS}\n\n${textPrompt.trim()}`
        : COMBINED_SYS
    );

    const userMessage =
      '目前的故事：\n' +
      (storySoFar || '') +
      '\n\n最新这一句是' +
      (speaker === 'dad' ? '爸爸' : '宝宝') +
      '说的：' +
      newLine;

    let narration: string;
    let followUpQuestion: string;
    let storySummary: string;
    let svg: string;

    try {
      const tModelStart = Date.now();
      const raw = isSemantic
        ? await generateStoryFrameSemantic(systemPrompt, userMessage)
        : await generateStoryFrame(systemPrompt, userMessage);
      console.log(`[story/generate] model call: ${Date.now() - tModelStart}ms`);

      if (isSemantic) {
        const parsed = parseSemanticResponse(raw, newLine);
        narration = parsed.narration;
        followUpQuestion = parsed.followUpQuestion;
        storySummary = parsed.storySummary;

        if (parsed.components.length > 0) {
          svg = renderScene(parsed.components as Array<{ id: string; role: 'support' | 'character' | 'detail' | 'background'; drawOrder: number }>);
        } else {
          svg = FALLBACK_SVG;
        }
      } else {
        const parsed = parseCombinedResponse(raw, newLine);
        narration = parsed.narration;
        followUpQuestion = parsed.followUpQuestion;
        storySummary = parsed.storySummary;

        const extracted = extractSvg(parsed.svg);
        svg = validateSvg(extracted);
        if (!svg) svg = FALLBACK_SVG;
      }
    } catch (textError) {
      if (!(textError instanceof NoApiKeyError)) {
        console.error('[api/story/generate]', (textError as Error).message);
      }
      const mock = getMockText(mockCounter++);
      narration = mock.narration;
      followUpQuestion = mock.followUpQuestion;
      storySummary = mock.storySummary;
      svg = FALLBACK_SVG;
    }

    try {
      svg = sanitizeSvg(svg);
    } catch (sanitizeError) {
      console.error('[api/story/generate] sanitizeSvg threw:', (sanitizeError as Error).message);
      svg = FALLBACK_SVG;
    }

    const res: GenerateResponse = {
      narration,
      svg,
      followUpQuestion: followUpQuestion || undefined,
      storySummary: storySummary || undefined,
    };
    return NextResponse.json(res);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[api/story/generate]', message);
    const err: GenerateError = { error: '画板打了个小盹，再说一次试试' };
    return NextResponse.json(err, { status: 500 });
  }
}
