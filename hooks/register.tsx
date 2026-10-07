import { atom, read, update } from 'claude-code'
import type { BoxProps, ElementConstructor, EngineInterface, MarkdownProps, Register, TextProps, Timer } from 'claude-code'

import type { Figures, Left, Meal } from '../types'

const PANE = 'token-hamster'
const TITLE = 'Token Hamster'
const STORE_KEY = 'lifetime'
const EMPTY: Meal = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
const NO_LEFT: Left = { limits: [] }

const session = atom({ plugin: 'token-hamster', key: 'session' } as const, EMPTY)
const lifetime = atom({ plugin: 'token-hamster', key: 'lifetime' } as const, 0)
const isEating = atom({ plugin: 'token-hamster', key: 'isEating' } as const, false)
const frame = atom({ plugin: 'token-hamster', key: 'frame' } as const, 0)
const left = atom({ plugin: 'token-hamster', key: 'left' } as const, NO_LEFT)

const KINDS = [
  { key: 'input', label: 'input', color: '#F2C14E' },
  { key: 'output', label: 'output', color: '#E76F51' },
  { key: 'cacheRead', label: 'cache read', color: '#8AB17D' },
  { key: 'cacheWrite', label: 'cache write', color: '#6C8EBF' },
] as const

export const sum = (m: Meal) => m.input + m.output + m.cacheRead + m.cacheWrite

export const fmt = (n: number) =>
  n >= 999_950_000 ? `${(n / 1e9).toFixed(2)}B`
  : n >= 999_950 ? `${(n / 1e6).toFixed(1)}M`
  : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k`
  : String(n)

const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)

const WINDOWS: Record<string, string> = { five_hour: 'session', seven_day: 'week' }

export const leftText = (l: Left) =>
  [
    ...(l.context === undefined ? [] : [`${fmt(l.context)} context left`]),
    ...l.limits.map(w => `${WINDOWS[w.kind] ?? w.kind} ${w.percentLeft}%`),
  ].join(' · ')

export type Mood = 'fine' | 'worried' | 'running' | 'empty'
export const mood = (l: Left): Mood => {
  const p = Math.min(100, ...l.limits.map(w => w.percentLeft))
  return p <= 0 ? 'empty' : p <= 25 ? 'running' : p <= 50 ? 'worried' : 'fine'
}
const MOOD_TEXT: Record<Mood, string> = {
  fine: '',
  worried: 'half the stash is gone',
  running: 'a quarter left, running it off',
  empty: 'out of food, asleep in the house',
}

export const until = (iso: string | undefined, now: number) => {
  const ms = iso ? Date.parse(iso) - now : NaN
  if (!(ms > 0)) return ''
  const h = Math.floor(ms / 3.6e6)
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${Math.floor(ms / 6e4) % 60}m`
}

export const moodText = (l: Left, now: number) => {
  const md = mood(l)
  if (md === 'fine') return ''
  const worst = [...l.limits].sort((a, b) => a.percentLeft - b.percentLeft)[0]
  const t = until(worst?.resetsAt, now)
  return t ? `${MOOD_TEXT[md]} · refill in ${t}` : MOOD_TEXT[md]
}

export const cacheHit = (m: Meal) => {
  const inTotal = m.input + m.cacheRead + m.cacheWrite
  return inTotal ? Math.round((m.cacheRead / inTotal) * 100) : 0
}

export const EATING = 'eating tokens…'
export const eaten = (m: Meal, suffix = '') => (sum(m) ? `${fmt(sum(m))} context tokens eaten${suffix}` : EATING)

export const statusText = (m: Meal, l: Left) =>
  [
    sum(m) ? `🐹 all ${fmt(sum(m))}` : `🐹 ${EATING}`,
    ...l.limits.map(w => `${WINDOWS[w.kind] ?? w.kind} ${w.percentLeft}%`),
    ...(l.cost === undefined ? [] : [`credits $${l.cost.toFixed(2)}`]),
  ].join(' · ')

export const cheek = (total: number) => 1 + Math.min(0.8, Math.log10(total + 1) / 11)

export const seedColors = (m: Meal) => {
  const total = sum(m)
  if (total === 0) return Array(6).fill(KINDS[0].color) as string[]
  const out: string[] = []
  for (const k of KINDS) {
    const n = Math.round((m[k.key] / total) * 6)
    for (let i = 0; i < n && out.length < 6; i++) out.push(k.color)
  }
  while (out.length < 6) out.push(KINDS[0].color)
  return out
}

const hamster = (m: Meal, eating: boolean, md: Mood = 'fine') => {
  const c = cheek(sum(m))
  const crx = (18 * c).toFixed(1)
  const cry = (15 * c).toFixed(1)
  const wob = (18 * c + 2).toFixed(1)
  const cheekAnim = eating
    ? `<animate attributeName="rx" values="${crx};${wob};${crx}" dur="0.35s" repeatCount="indefinite"/>`
    : ''
  const eyes = eating
    ? [102, 138].map(x => `
      <ellipse cx="${x}" cy="92" rx="6" ry="6" fill="#2B2118">
        <animate attributeName="ry" values="6;6;0.6;6" keyTimes="0;0.9;0.95;1" dur="3.5s" repeatCount="indefinite"/>
      </ellipse>
      <circle cx="${x + 2}" cy="90" r="2" fill="#fff"/>`).join('')
    : [102, 138].map(x => `<path d="M${x - 6} 93 Q${x} 98 ${x + 6} 93" stroke="#2B2118" stroke-width="2.5" fill="none" stroke-linecap="round"/>`).join('')
  const mouth = eating
    ? `<ellipse cx="120" cy="116" rx="5" ry="2" fill="#7A3B3B">
        <animate attributeName="ry" values="1;4;1" dur="0.35s" repeatCount="indefinite"/>
      </ellipse>`
    : md === 'fine'
    ? `<path d="M113 112 Q120 118 127 112" stroke="#7A3B3B" stroke-width="2" fill="none" stroke-linecap="round"/>`
    : `<path d="M113 116 Q120 110 127 116" stroke="#7A3B3B" stroke-width="2" fill="none" stroke-linecap="round"/>`
  const brows = md === 'fine' || md === 'empty' ? '' : `
    <path d="M94 80 L108 76" stroke="#7A4B3A" stroke-width="3" stroke-linecap="round"/>
    <path d="M146 80 L132 76" stroke="#7A4B3A" stroke-width="3" stroke-linecap="round"/>`
  const sweat = (md === 'worried' ? [120] : md === 'running' ? [112, 128] : []).map((x, i) => `
    <path d="M${x} 58 q-5 8 0 11 q5 -3 0 -11z" fill="#8FC3F0" opacity="0">
      <animate attributeName="opacity" values="0;1;0" dur="1.6s" begin="${i * 0.8}s" repeatCount="indefinite"/>
      <animateTransform attributeName="transform" type="translate" values="0 0;0 14" dur="1.6s" begin="${i * 0.8}s" repeatCount="indefinite"/>
    </path>`).join('')
  const shake = md === 'running'
    ? `<animateTransform attributeName="transform" type="translate" values="0 0;1.5 0;-1.5 0;0 0" dur="0.25s" repeatCount="indefinite"/>`
    : ''
  const seeds = eating
    ? seedColors(m).map((color, i) => {
        const x = 30 + i * 36
        return `
      <g opacity="0">
        <ellipse rx="4" ry="7" fill="${color}" stroke="#00000033"/>
        <animateMotion path="M${x} -10 Q${x} 60 120 116" dur="1.2s" begin="${(i * 0.2).toFixed(1)}s" repeatCount="indefinite" rotate="auto"/>
        <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.85;1" dur="1.2s" begin="${(i * 0.2).toFixed(1)}s" repeatCount="indefinite"/>
      </g>`
      }).join('')
    : ''
  const zzz = eating
    ? ''
    : [0, 1, 2].map(i => `
      <text x="${172 + i * 12}" y="60" font-family="sans-serif" font-size="${12 + i * 4}" fill="#9A8C7E" opacity="0">z
        <animate attributeName="y" values="64;30" dur="3s" begin="${i}s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0;1;0" dur="3s" begin="${i}s" repeatCount="indefinite"/>
      </text>`).join('')
  const breathe = eating ? '' : `<animateTransform attributeName="transform" type="scale" values="1 1;1.02 0.98;1 1" dur="3s" additive="sum" repeatCount="indefinite"/>`

  return `
  <g transform-origin="120 190">
    ${breathe}
    <g>${shake}
    <ellipse cx="120" cy="190" rx="70" ry="6" fill="#00000018"/>
    <ellipse cx="120" cy="145" rx="70" ry="48" fill="#E9A96B"/>
    <ellipse cx="120" cy="155" rx="42" ry="32" fill="#FBE3C8"/>
    <circle cx="80" cy="62" r="16" fill="#E9A96B"/><circle cx="80" cy="62" r="9" fill="#F5B8B0"/>
    <circle cx="160" cy="62" r="16" fill="#E9A96B"/><circle cx="160" cy="62" r="9" fill="#F5B8B0"/>
    <ellipse cx="120" cy="96" rx="52" ry="44" fill="#E9A96B"/>
    <ellipse cx="82" cy="112" rx="${crx}" ry="${cry}" fill="#F4C59A">${cheekAnim}</ellipse>
    <ellipse cx="158" cy="112" rx="${crx}" ry="${cry}" fill="#F4C59A">${cheekAnim}</ellipse>
    <circle cx="80" cy="110" r="6" fill="#F29E9E" opacity="0.55"/>
    <circle cx="160" cy="110" r="6" fill="#F29E9E" opacity="0.55"/>
    <ellipse cx="120" cy="110" rx="26" ry="20" fill="#FBE3C8"/>
    ${eyes}
    <ellipse cx="120" cy="104" rx="4" ry="3" fill="#D9707A"/>
    ${mouth}
    <ellipse cx="106" cy="132" rx="7" ry="5" fill="#F4C59A"/>
    <ellipse cx="134" cy="132" rx="7" ry="5" fill="#F4C59A"/>
    <ellipse cx="96" cy="188" rx="12" ry="5" fill="#F4C59A"/>
    <ellipse cx="144" cy="188" rx="12" ry="5" fill="#F4C59A"/>
    ${brows}${sweat}
    </g>
  </g>
  ${seeds}
  ${zzz}`
}

export const hamsterSvg = (m: Meal, eating: boolean, md: Mood = 'fine') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="240" height="200">${hamster(m, eating, md)}</svg>`

export const sideHamster = (step: number) => {
  const leg = (x: number, phase: number, far: boolean) => `
    <g transform="translate(${x} -13)"><g>
      <animateTransform attributeName="transform" type="rotate" values="-38;34;-38" dur="${step}s" begin="${(-phase * step).toFixed(3)}s" repeatCount="indefinite"/>
      <rect x="-3.2" y="0" width="6.4" height="12" rx="3.2" fill="${far ? '#D4914F' : '#E9A96B'}"/>
      <ellipse cx="2" cy="12" rx="5" ry="2.6" fill="${far ? '#E8B48A' : '#F4C59A'}"/>
    </g></g>`
  const bob = (step / 2).toFixed(3)
  return `
  <g>
    <animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="${bob}s" repeatCount="indefinite"/>
    ${leg(-17, 0.5, true)}${leg(25, 0, true)}
    ${leg(-21, 0, false)}${leg(21, 0.5, false)}
    <g transform-origin="0 -6">
      <animateTransform attributeName="transform" type="scale" values="1 1;1.05 0.95;1 1" dur="${bob}s" repeatCount="indefinite"/>
      <ellipse cx="-36" cy="-15" rx="4" ry="3" fill="#F4C59A"/>
      <path d="M-36 -12 C-38 -34 -16 -46 6 -45 C26 -44 40 -36 46 -24 C50 -14 44 -6 30 -6 L-24 -6 C-33 -6 -36 -8 -36 -12 Z" fill="#E9A96B"/>
      <path d="M-26 -7 C-20 -18 8 -20 28 -10 C30 -7 27 -6 24 -6 L-22 -6 Z" fill="#FBE3C8"/>
      <ellipse cx="34" cy="-17" rx="11" ry="8" fill="#F4C59A"/>
      <ellipse cx="45" cy="-24" rx="8" ry="6" fill="#FBE3C8"/>
      <circle cx="52" cy="-26" r="2.6" fill="#D9707A"/>
      <path d="M48 -23 L62 -27 M48 -22 L63 -22 M48 -21 L61 -17" stroke="#9A8C7E" stroke-width="0.8" stroke-linecap="round"/>
      <ellipse cx="36" cy="-32" rx="3.4" ry="3.8" fill="#2B2118"/>
      <circle cx="37.2" cy="-33.4" r="1.1" fill="#fff"/>
      <g transform="rotate(-18 20 -44)">
        <ellipse cx="20" cy="-44" rx="6" ry="7" fill="#E9A96B"/>
        <ellipse cx="20" cy="-43" rx="3.4" ry="4.4" fill="#F5B8B0"/>
      </g>
      <path d="M42 -42 q-4 7 0 10 q4 -3 0 -10z" fill="#8FC3F0">
        <animate attributeName="opacity" values="1;0" dur="0.8s" repeatCount="indefinite"/>
        <animateTransform attributeName="transform" type="translate" values="0 0;-12 -6" dur="0.8s" repeatCount="indefinite"/>
      </path>
    </g>
  </g>`
}

const wheel = (r: number, spin: string, md: Mood, runScale: number) => {
  const spokes = [0, 45, 90, 135].map(a => `<line x1="0" y1="${4 - r}" x2="0" y2="${r - 4}" transform="rotate(${a})" stroke="#B9C3CF" stroke-width="3"/>`).join('')
  const running = md === 'running'
  return `
    <path d="M${(-0.57 * r).toFixed(1)} ${r + 8} L0 0 L${(0.57 * r).toFixed(1)} ${r + 8}" stroke="#9AA6B4" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle r="${r}" fill="none" stroke="#9AA6B4" stroke-width="5"/>
    <g>${spokes}<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="${running ? '0.5s' : spin}" repeatCount="indefinite"/></g>
    <circle r="5" fill="#9AA6B4"/>
    ${running ? `<g transform="translate(0 ${r - 5}) scale(${runScale})">${sideHamster(0.2)}</g>` : ''}`
}

export const paneWheelSvg = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="240" height="200">
  <rect x="0" y="190" width="240" height="10" rx="5" fill="#E8D3A8"/>
  <g transform="translate(120 106)">${wheel(76, '14s', 'running', 0.92)}</g>
</svg>`

const house = (asleep: boolean) => `
    <path d="M0 80 L0 26 Q45 -16 90 26 L90 80 Z" fill="#E58F6B"/>
    <path d="M-6 30 Q45 -24 96 30" stroke="#C96F4E" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M30 80 L30 52 Q45 38 60 52 L60 80 Z" fill="#7A4B3A"/>
    ${asleep ? `
    <g transform-origin="45 80">
      <animateTransform attributeName="transform" type="scale" values="1 1;1.03 0.97;1 1" dur="3s" repeatCount="indefinite"/>
      <circle cx="37" cy="61" r="4.5" fill="#E9A96B"/><circle cx="37" cy="61" r="2.2" fill="#F5B8B0"/>
      <circle cx="53" cy="61" r="4.5" fill="#E9A96B"/><circle cx="53" cy="61" r="2.2" fill="#F5B8B0"/>
      <ellipse cx="45" cy="72" rx="13" ry="10" fill="#E9A96B"/>
      <ellipse cx="45" cy="76" rx="7" ry="4.5" fill="#FBE3C8"/>
      <path d="M38 70 q2.5 2.5 5 0 M47 70 q2.5 2.5 5 0" stroke="#2B2118" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <circle cx="45" cy="74.5" r="1.5" fill="#D9707A"/>
    </g>
    ${[0, 1, 2].map(i => `
    <text x="${56 + i * 8}" y="20" font-family="sans-serif" font-size="${10 + i * 4}" fill="#9A8C7E" opacity="0">z
      <animate attributeName="y" values="24;-14" dur="3s" begin="${i}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;1;0" dur="3s" begin="${i}s" repeatCount="indefinite"/>
    </text>`).join('')}` : ''}`

export const paneHouseSvg = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="240" height="200">
  <rect x="0" y="190" width="240" height="10" rx="5" fill="#E8D3A8"/>
  <g transform="translate(30 30) scale(2)">${house(true)}</g>
</svg>`

const bandText = (m: Meal, l: Left) => {
  const md = mood(l)
  return `
  <text x="285" y="46" font-family="ui-sans-serif, system-ui, sans-serif" font-size="36" font-weight="700" fill="#5B4636">${sum(m) ? `${fmt(sum(m))}<tspan font-size="26" font-weight="600" fill="#7A6656"> context tokens eaten</tspan>` : EATING}</text>
  <text x="285" y="80" font-family="ui-sans-serif, system-ui, sans-serif" font-size="20" font-weight="600" fill="#5B4636">${esc(leftText(l))}</text>
  <text x="285" y="110" font-family="ui-sans-serif, system-ui, sans-serif" font-size="19" font-weight="700" fill="${md === 'worried' ? '#C98A2B' : '#C0453A'}">${esc(moodText(l, l.at ?? 0))}</text>`
}

export const sceneSvg = (m: Meal, eating: boolean, l = NO_LEFT) => {
  const md = mood(l)
  const dust = [-300, -120, 60, 150, 330, 420, 700, 790, 960, 1130, 1300, 1480].map((x, i) =>
    `<path d="M${x} ${143 + (i % 3) * 2} q6 -3 12 0" stroke="#CDB98F" stroke-width="2" fill="none"/>`).join('')
  const pebbles = [-200, 90, 380, 760, 1050, 1400].map((x, i) =>
    `<ellipse cx="${x}" cy="${145 + (i % 2) * 2}" rx="${6 + (i % 3) * 2}" ry="2.5" fill="#C9B48A"/>`).join('')
  const motes = [120, 300, 470, 720, 900, 1110].map((x, i) => `
    <circle cx="${x}" cy="100" r="${1.5 + (i % 3) * 0.7}" fill="#F2C14E" opacity="0">
      <animate attributeName="cy" values="120;20" dur="${7 + i}s" begin="${i * 1.1}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;0.7;0" dur="${7 + i}s" begin="${i * 1.1}s" repeatCount="indefinite"/>
    </circle>`).join('')
  const sprout = (x: number, h: number) =>
    `<path d="M${x} 140 q-6 -${h / 2} 0 -${h}" stroke="#7FA65A" stroke-width="4" fill="none" stroke-linecap="round">
      <animateTransform attributeName="transform" type="rotate" values="-3 ${x} 140;3 ${x} 140;-3 ${x} 140" dur="5s" repeatCount="indefinite"/></path>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
  <rect x="-4000" y="-500" width="9200" height="640" fill="#F7EEDF"/>
  <rect x="-4000" y="140" width="9200" height="500" fill="#E8D3A8"/>
  <path d="M-4000 140 H5200" stroke="#D9C091" stroke-width="2"/>
  ${dust}${pebbles}${motes}
  ${sprout(40, 34)}${sprout(52, 24)}${sprout(1160, 30)}${sprout(1172, 40)}
  <g transform="translate(180 67)">${wheel(65, eating ? '1.2s' : '14s', md, 0.87)}</g>
  <g transform="translate(963 2) scale(1.72)">${house(md === 'empty')}</g>
  ${md === 'running' || md === 'empty' ? '' : `<g transform="translate(745 -31) scale(0.9)">${hamster(m, eating, md)}</g>`}
  ${bandText(m, l)}
</svg>`
}

const PX: Record<string, string> = {
  O: '#E9A96B',
  C: '#F4C59A',
  B: '#FBE3C8',
  P: '#F5B8B0',
  E: '#2B2118',
  W: '#FFFFFF',
  N: '#D9707A',
  M: '#7A3B3B',
  D: '#8FC3F0',
}

export const hamsterPixels = (m: Meal, eating: boolean, f: number, md: Mood = 'fine') => {
  const g = [
    '...OO........OO...',
    '..OPPO......OPPO..',
    '..OOOOOOOOOOOOOO..',
    '.OOOOOOOOOOOOOOOO.',
    '.OOOOOOOOOOOOOOOO.',
    'OOOOOOOOOOOOOOOOOO',
    'OCCCOOOBBBBOOOCCCO',
    'CCCCOOBBNNBBOOCCCC',
    'CCCCCBBBBBBBBCCCCC',
    '.CCCBBBBBBBBBBCCC.',
    '.OOOBBBBBBBBBBOOO.',
    '..OOOBBBBBBBBOOO..',
    '...OOOOOOOOOOOO...',
    '...CCC......CCC...',
  ].map(r => r.split(''))
  const put = (y: number, x: number, c: string) => { g[y]![x] = c }
  const awake = eating || md === 'worried' || md === 'running'
  for (const x of [4, 12]) {
    if (md === 'running') { put(4, x, 'W'); put(4, x + 1, 'W'); put(5, x, 'E'); put(5, x + 1, 'E') }
    else if (awake) { put(4, x, 'E'); put(4, x + 1, 'W'); put(5, x, 'E'); put(5, x + 1, 'E') }
    else { put(5, x, 'E'); put(5, x + 1, 'E') }
  }
  if (md === 'worried' || md === 'running') { put(3, 4, 'E'); put(3, 5, 'E'); put(3, 12, 'E'); put(3, 13, 'E') }
  if (eating && f % 2) { put(8, 8, 'M'); put(8, 9, 'M') }
  if (md === 'worried') { put(2, 8, 'D'); put(3, 8, 'D') }
  if (md === 'running') { put(2, 6, 'D'); put(3, 6, 'D'); put(2, 11, 'D'); put(3, 11, 'D') }
  const puff = cheek(sum(m)) > 1.35
  for (const [y, r] of g.entries()) {
    const c = puff && (y === 7 || y === 8) ? 'C' : '.'
    r.unshift(c); r.push(c)
  }
  return g.map(r => r.join(''))
}

export const halfBlocks = (rows: string[]) => {
  const out: { ch: string; fg?: string; bg?: string }[][] = []
  for (let y = 0; y < rows.length; y += 2) {
    out.push([...rows[y]!].map((t, x) => {
      const b = rows[y + 1]?.[x] ?? '.'
      const top = PX[t], bot = PX[b]
      return !top && !bot ? { ch: ' ' }
        : top === bot ? { ch: '█', fg: top }
        : !bot ? { ch: '▀', fg: top }
        : !top ? { ch: '▄', fg: bot }
        : { ch: '▀', fg: top, bg: bot }
    }))
  }
  return out
}

const refreshLeft = async ($: EngineInterface) => {
  const u = await $.session.usage().catch(() => undefined)
  if (!u) return
  const { tokens, window } = u.context
  const now = await $.clock.now().catch(() => 0)
  const next: Left = {
    context: tokens === undefined ? undefined : Math.max(0, window - tokens),
    window,
    cost: u.cost?.usd,
    at: Math.floor(now / 60_000) * 60_000,
    limits: u.rateLimits.map(w => ({
      kind: w.kind,
      percentLeft: Math.max(0, Math.round(100 - w.percentUsed)),
      resetsAt: w.resetsAt,
    })),
  }
  await update($, left, () => next)
}

const feed = async ($: EngineInterface, u: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }) => {
  const meal: Meal = {
    input: u.input_tokens,
    output: u.output_tokens,
    cacheRead: u.cache_read_input_tokens,
    cacheWrite: u.cache_creation_input_tokens,
  }
  await update($, session, s => ({
    input: s.input + meal.input,
    output: s.output + meal.output,
    cacheRead: s.cacheRead + meal.cacheRead,
    cacheWrite: s.cacheWrite + meal.cacheWrite,
  }))
  const stored = await $.store.get(STORE_KEY)
  const life = (typeof stored === 'number' && Number.isFinite(stored) ? stored : 0) + sum(meal)
  await $.store.set(STORE_KEY, life)
  await update($, lifetime, () => life)
  await refreshLeft($)
  await showStatus($)
}

const showStatus = async ($: EngineInterface) => {
  $.ui.status(statusText(await read($, session), await read($, left)))
}

export const paneStatus = (m: Meal, l: Left, eating: boolean) => {
  const md = mood(l)
  return md !== 'fine' ? moodText(l, l.at ?? 0) : eating ? 'nom nom nom…' : sum(m) ? 'full and napping' : 'hungry, waiting for a prompt'
}

export const paneFigures = (m: Meal, life: number, l: Left, eating: boolean): Figures => ({
  blocks: [
    { text: eaten(m, ' this session'), bold: true },
    { text: `${fmt(life)} lifetime · ${paneStatus(m, l, eating)}`, dim: true },
    ...l.limits.map(w => {
      const t = until(w.resetsAt, l.at ?? 0)
      const name = w.kind === 'five_hour' ? 'Session limit' : w.kind === 'seven_day' ? 'Weekly' : w.kind
      return { text: `${name}: ${w.percentLeft}% left${t ? ` · resets in ${t}` : ''}` }
    }),
    ...(l.context === undefined ? [] : [{ text: `Context: ${fmt(l.context)} left` }]),
    { text: `${l.cost === undefined ? '' : `$${l.cost.toFixed(2)} · `}cache hit ${cacheHit(m)}%`, dim: true },
    ...KINDS.map(k => ({ text: `${k.label}: ${fmt(m[k.key])}`, dot: k.color })),
  ],
})

const drawFigures = (
  Box: ElementConstructor<BoxProps>,
  Text: ElementConstructor<TextProps>,
  Markdown: ElementConstructor<MarkdownProps>,
  f: Figures,
) => (
  <Box flexDirection="column">
    {f.blocks.map(b =>
      'md' in b ? <Markdown text={b.md} /> : (
        <Text bold={b.bold} dimColor={b.dim} color={b.color}>
          {b.dot && <Text color={b.dot}>● </Text>}
          {b.text}
        </Text>
      ))}
  </Box>
)

const hamsterCells = (Text: ElementConstructor<TextProps>, m: Meal, eating: boolean, f: number, md: Mood) =>
  halfBlocks(hamsterPixels(m, eating, f, md)).map((row, y) => (
    <Text>
      {row.map(c => <Text color={c.fg} backgroundColor={c.bg}>{c.ch}</Text>)}
      {y === 3 && <Text color="#F2C14E">{md === 'running' ? '' : eating && md !== 'empty' ? '  ∘ • · ∘ •'.slice(f % 4) : '  z Z z'}</Text>}
    </Text>
  ))

export const register: Register = on => {
  let chew: Timer | undefined

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'hamster', description: 'Open the Token Hamster pane' })
    const stored = await $.store.get(STORE_KEY)
    await update($, lifetime, () => (typeof stored === 'number' && Number.isFinite(stored) ? stored : 0))
    await refreshLeft($)
    return next(e)
  })

  on('command.run', { command: 'hamster' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'Token Hamster pane opened.' }
  })

  on('turn.start', async ($, e, next) => {
    await update($, isEating, () => true)
    chew?.cancel()
    chew = $.clock.every(300, () => void update($, frame, n => n + 1))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.usage) await feed($, e.usage)
    if (!e.agentId) {
      chew?.cancel()
      chew = undefined
      await update($, isEating, () => false)
      await refreshLeft($)
    }
    await showStatus($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const details = () => void $.ui.open({ id: PANE, title: TITLE })

    if (e.surface === 'terminal') {
      const m = await read($, session)
      const eating = await read($, isEating)
      const l = await read($, left)
      const md = mood(l)
      const { Box, Text, Button } = $.ui.resolve(e)
      const f = eating ? await read($, frame) : 0
      return (
        <Box flexDirection="row" gap={2}>
          <Box flexDirection="column">
            {hamsterCells(Text, m, eating, f, md)}
          </Box>
          <Box flexDirection="column">
            <Text bold>{eaten(m)}</Text>
            <Text dimColor>{leftText(l)}</Text>
            {md !== 'fine' && <Text bold color={md === 'worried' ? 'yellow' : 'red'}>{moodText(l, l.at ?? 0)}</Text>}
            <Button key="details" label="Details" hotkey="d" variant="secondary" onPress={details} />
          </Box>
        </Box>
      )
    }

    const m = await read($, session)
    const eating = await read($, isEating)
    const l = await read($, left)
    const { Box, Svg, Button } = $.ui.resolve(e)
    return (
      <Box position="relative" width="100%" flexGrow={1} borderStyle="round" borderColor="#E9A96B" paddingX={1}>
        <Box width="100%">
          <Svg
            source={sceneSvg(m, eating, l)}
            alt={`A hamster in its cage that has eaten ${eaten(m)}`}
            width={e.props.bodyColumns * 8}
            height={140}
            isInteractive
          />
        </Box>
        <Box position="absolute" top={0} right={2} flexDirection="row" gap={1}>
          <Button key="details" label=" Details " hotkey="d" variant="secondary" onPress={details} />
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (e.surface === 'terminal') {
      const m = await read($, session)
      const life = await read($, lifetime)
      const l = await read($, left)
      const eating = await read($, isEating)
      const { Box, Text } = $.ui.resolve(e)
      const f = eating ? await read($, frame) : 0
      return (
        <Box flexDirection="column">
          {hamsterCells(Text, m, eating, f, mood(l))}
          {drawFigures(Box, Text, $.ui.resolve(e).Markdown, paneFigures(m, life, l, eating))}
        </Box>
      )
    }

    const m = await read($, session)
    const eating = await read($, isEating)
    const l = await read($, left)
    const md = mood(l)
    const { Box, Svg, Markdown, Text } = $.ui.resolve(e)
    const figures = drawFigures(Box, Text, Markdown, paneFigures(m, await read($, lifetime), l, eating))
    return (
      <Box flexDirection="column" alignItems="center">
        <Svg
          source={md === 'running' ? paneWheelSvg() : md === 'empty' ? paneHouseSvg() : hamsterSvg(m, eating, md)}
          alt={`A hamster, ${md === 'running' ? 'running in its wheel' : md === 'empty' ? 'asleep in its house' : eating ? 'eating' : 'napping'}`}
          width={320}
          height={267}
          isInteractive
        />
        {figures}
      </Box>
    )
  })
}
