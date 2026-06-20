const MOCK_SCENES = [
  {
    narration: '蝴蝶轻轻落在花瓣上，小恐龙看呆了。',
    followUpQuestion: '小恐龙接下来会做什么呢？',
    storySummary: '小恐龙在花园里看到一只蝴蝶停在花瓣上，他被美丽的蝴蝶吸引住了。',
    en: {
      narration: 'A butterfly landed softly on a petal, and the little dinosaur stared in wonder.',
      followUpQuestion: 'What will the little dinosaur do next?',
      storySummary: 'In the garden, the little dinosaur saw a butterfly resting on a petal and was enchanted by it.',
    },
    svg: `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <line x1="200" y1="280" x2="200" y2="180" stroke="#1f1c18" stroke-width="3" stroke-linecap="round"/>
  <circle cx="200" cy="170" r="18" fill="none" stroke="#1f1c18" stroke-width="3"/>
  <path d="M200 152 q-14 -16 0 -24 q14 8 0 24" fill="none" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
  <path d="M200 152 q14 -16 0 -24 q-14 8 0 24" fill="none" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
  <circle cx="200" cy="170" r="4" fill="none" stroke="#1f1c18" stroke-width="2"/>
  <line x1="200" y1="175" x2="196" y2="180" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
  <line x1="200" y1="175" x2="204" y2="180" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
  <path d="M50 120 q60 -40 120 0 q60 40 120 0 q60 40 60 0" fill="none" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
  <circle cx="330" cy="220" r="24" fill="none" stroke="#1f1c18" stroke-width="3"/>
  <circle cx="322" cy="212" r="4" fill="none" stroke="#1f1c18" stroke-width="2"/>
  <circle cx="338" cy="212" r="4" fill="none" stroke="#1f1c18" stroke-width="2"/>
  <path d="M322 230 q8 6 16 0" fill="none" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
</svg>`,
  },
  {
    narration: '突然，花丛里跳出一只小青蛙！',
    followUpQuestion: '小青蛙想跟小恐龙说什么呢？',
    storySummary: '小恐龙在花园里看蝴蝶时，花丛中突然跳出一只小青蛙，两个小动物相遇了。',
    en: {
      narration: 'Suddenly, a little frog hopped out of the flowers!',
      followUpQuestion: 'What does the little frog want to say to the dinosaur?',
      storySummary: 'While the little dinosaur watched the butterfly, a little frog suddenly leapt out of the flowers, and the two animals met.',
    },
    svg: `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="200" cy="210" rx="32" ry="26" fill="none" stroke="#1f1c18" stroke-width="3"/>
  <circle cx="220" cy="190" r="14" fill="none" stroke="#1f1c18" stroke-width="3"/>
  <circle cx="214" cy="186" r="5" fill="none" stroke="#1f1c18" stroke-width="2"/>
  <circle cx="226" cy="186" r="5" fill="none" stroke="#1f1c18" stroke-width="2"/>
  <path d="M214 200 q6 5 12 0" fill="none" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
  <line x1="180" y1="210" x2="140" y2="195" stroke="#1f1c18" stroke-width="3" stroke-linecap="round"/>
  <line x1="220" y1="210" x2="260" y2="195" stroke="#1f1c18" stroke-width="3" stroke-linecap="round"/>
  <line x1="185" y1="235" x2="155" y2="255" stroke="#1f1c18" stroke-width="3" stroke-linecap="round"/>
  <line x1="215" y1="235" x2="245" y2="255" stroke="#1f1c18" stroke-width="3" stroke-linecap="round"/>
  <circle cx="178" cy="192" r="3" fill="none" stroke="#1f1c18" stroke-width="2"/>
  <circle cx="262" cy="192" r="3" fill="none" stroke="#1f1c18" stroke-width="2"/>
  <path d="M100 260 q30 -70 60 -20 q30 50 60 20 q30 -30 60 0" fill="none" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
</svg>`,
  },
  {
    narration: '小青蛙和小恐龙成了好朋友。',
    followUpQuestion: '两个好朋友准备一起去哪里呢？',
    storySummary: '小恐龙和花园里的小青蛙成了好朋友，它们在花园里一起玩耍。',
    en: {
      narration: 'The little frog and the little dinosaur became good friends.',
      followUpQuestion: 'Where will the two friends go together?',
      storySummary: 'The little dinosaur and the frog became good friends and played together in the garden.',
    },
    svg: `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <circle cx="260" cy="200" r="28" fill="none" stroke="#1f1c18" stroke-width="3"/>
  <circle cx="252" cy="192" r="5" fill="none" stroke="#1f1c18" stroke-width="2"/>
  <circle cx="270" cy="192" r="5" fill="none" stroke="#1f1c18" stroke-width="2"/>
  <path d="M256 212 q8 6 16 0" fill="none" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="140" cy="220" rx="28" ry="22" fill="none" stroke="#1f1c18" stroke-width="3"/>
  <circle cx="158" cy="204" r="12" fill="none" stroke="#1f1c18" stroke-width="3"/>
  <circle cx="152" cy="200" r="4" fill="none" stroke="#1f1c18" stroke-width="2"/>
  <circle cx="164" cy="200" r="4" fill="none" stroke="#1f1c18" stroke-width="2"/>
  <path d="M152 214 q5 4 10 0" fill="none" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
  <line x1="210" y1="185" x2="216" y2="200" stroke="#1f1c18" stroke-width="3" stroke-linecap="round"/>
  <line x1="195" y1="185" x2="189" y2="200" stroke="#1f1c18" stroke-width="3" stroke-linecap="round"/>
  <line x1="203" y1="170" x2="203" y2="185" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
  <path d="M150 210 q10 30 80 5" fill="none" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
  <line x1="120" y1="240" x2="90" y2="265" stroke="#1f1c18" stroke-width="3" stroke-linecap="round"/>
  <line x1="165" y1="242" x2="175" y2="268" stroke="#1f1c18" stroke-width="3" stroke-linecap="round"/>
  <line x1="245" y1="228" x2="240" y2="255" stroke="#1f1c18" stroke-width="3" stroke-linecap="round"/>
  <line x1="280" y1="228" x2="295" y2="258" stroke="#1f1c18" stroke-width="3" stroke-linecap="round"/>
</svg>`,
  },
  {
    narration: '它们一起去看远处的彩虹。',
    followUpQuestion: '彩虹下面会有什么惊喜呢？',
    storySummary: '小恐龙和小青蛙这对好朋友一起出发去看远处天上的彩虹，旅途充满欢笑。',
    en: {
      narration: 'Together they set off to see the rainbow in the distance.',
      followUpQuestion: 'What surprise waits at the end of the rainbow?',
      storySummary: 'The little dinosaur and the frog set off together toward the faraway rainbow, their journey full of laughter.',
    },
    svg: `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <path d="M80 180 q90 -120 240 0" fill="none" stroke="#1f1c18" stroke-width="3" stroke-linecap="round"/>
  <path d="M100 180 q80 -100 200 0" fill="none" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
  <path d="M120 180 q70 -80 160 0" fill="none" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
  <path d="M140 180 q60 -60 120 0" fill="none" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
  <circle cx="150" cy="240" r="22" fill="none" stroke="#1f1c18" stroke-width="3"/>
  <circle cx="144" cy="234" r="4" fill="none" stroke="#1f1c18" stroke-width="2"/>
  <circle cx="158" cy="234" r="4" fill="none" stroke="#1f1c18" stroke-width="2"/>
  <path d="M146 248 q6 5 12 0" fill="none" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
  <line x1="130" y1="260" x2="110" y2="280" stroke="#1f1c18" stroke-width="3" stroke-linecap="round"/>
  <line x1="170" y1="260" x2="190" y2="280" stroke="#1f1c18" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="280" cy="250" rx="24" ry="20" fill="none" stroke="#1f1c18" stroke-width="3"/>
  <circle cx="296" cy="236" r="11" fill="none" stroke="#1f1c18" stroke-width="3"/>
  <circle cx="290" cy="232" r="3" fill="none" stroke="#1f1c18" stroke-width="2"/>
  <circle cx="302" cy="232" r="3" fill="none" stroke="#1f1c18" stroke-width="2"/>
  <path d="M290 246 q5 4 10 0" fill="none" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
  <line x1="265" y1="270" x2="255" y2="285" stroke="#1f1c18" stroke-width="3" stroke-linecap="round"/>
  <line x1="295" y1="270" x2="305" y2="285" stroke="#1f1c18" stroke-width="3" stroke-linecap="round"/>
  <line x1="200" y1="200" x2="210" y2="235" stroke="#1f1c18" stroke-width="3" stroke-linecap="round"/>
  <path d="M200 220 q8 -6 12 0" fill="none" stroke="#1f1c18" stroke-width="2" stroke-linecap="round"/>
</svg>`,
  },
];

export function getMockScene(index: number, lang: 'zh' | 'en' = 'zh'): { narration: string; svg: string } {
  const scene = MOCK_SCENES[index % MOCK_SCENES.length];
  const copy = lang === 'en' ? scene.en : scene;
  return { narration: copy.narration, svg: scene.svg };
}

export function getMockText(index: number, lang: 'zh' | 'en' = 'zh'): {
  narration: string;
  followUpQuestion: string;
  storySummary: string;
} {
  const scene = MOCK_SCENES[index % MOCK_SCENES.length];
  const copy = lang === 'en' ? scene.en : scene;
  return {
    narration: copy.narration,
    followUpQuestion: copy.followUpQuestion,
    storySummary: copy.storySummary,
  };
}

let mockHintCounter = 0;

const MOCK_HINTS_ZH = [
  '小恐龙接下来会遇到谁呢？',
  '要不要去花园里看看有什么？',
  '他们可以一起做什么游戏呢？',
  '小恐龙现在心里在想什么呢？',
  '要不要让一个新朋友加入故事？',
];

const MOCK_HINTS_EN = [
  'What will the little dinosaur do next?',
  'How about exploring the garden?',
  'What game could they play together?',
  'What is the little dinosaur thinking right now?',
  'Maybe a new friend could join the story?',
];

export function getMockHint(lang: 'zh' | 'en'): string {
  const pool = lang === 'zh' ? MOCK_HINTS_ZH : MOCK_HINTS_EN;
  return pool[mockHintCounter++ % pool.length];
}
