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

export const until = (iso: string | undefined, now: number) => {
  const ms = iso ? Date.parse(iso) - now : NaN
  if (!(ms > 0)) return ''
  const h = Math.floor(ms / 3.6e6)
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${Math.floor(ms / 6e4) % 60}m`
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

const hamster = (m: Meal, eating: boolean) => {
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
    : `<path d="M113 112 Q120 118 127 112" stroke="#7A3B3B" stroke-width="2" fill="none" stroke-linecap="round"/>`
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
  </g>
  ${seeds}
  ${zzz}`
}

export const hamsterSvg = (m: Meal, eating: boolean) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="240" height="200">${hamster(m, eating)}</svg>`

const wheel = (r: number, spin: string) => {
  const spokes = [0, 45, 90, 135].map(a => `<line x1="0" y1="${4 - r}" x2="0" y2="${r - 4}" transform="rotate(${a})" stroke="#B9C3CF" stroke-width="3"/>`).join('')
  return `
    <path d="M${(-0.57 * r).toFixed(1)} ${r + 8} L0 0 L${(0.57 * r).toFixed(1)} ${r + 8}" stroke="#9AA6B4" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle r="${r}" fill="none" stroke="#9AA6B4" stroke-width="5"/>
    <g>${spokes}<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="${spin}" repeatCount="indefinite"/></g>
    <circle r="5" fill="#9AA6B4"/>`
}

const house = `
    <path d="M0 80 L0 26 Q45 -16 90 26 L90 80 Z" fill="#E58F6B"/>
    <path d="M-6 30 Q45 -24 96 30" stroke="#C96F4E" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M30 80 L30 52 Q45 38 60 52 L60 80 Z" fill="#7A4B3A"/>`

const bandText = (m: Meal, l: Left) => `
  <text x="285" y="46" font-family="ui-sans-serif, system-ui, sans-serif" font-size="36" font-weight="700" fill="#5B4636">${sum(m) ? `${fmt(sum(m))}<tspan font-size="26" font-weight="600" fill="#7A6656"> context tokens eaten</tspan>` : EATING}</text>
  <text x="285" y="80" font-family="ui-sans-serif, system-ui, sans-serif" font-size="20" font-weight="600" fill="#5B4636">${esc(leftText(l))}</text>`

export const sceneSvg = (m: Meal, eating: boolean, l = NO_LEFT) => {
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
  <g transform="translate(180 67)">${wheel(65, eating ? '1.2s' : '14s')}</g>
  <g transform="translate(963 2) scale(1.72)">${house}</g>
  <g transform="translate(745 -31) scale(0.9)">${hamster(m, eating)}</g>
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

export const hamsterPixels = (m: Meal, eating: boolean, f: number) => {
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
  for (const x of [4, 12]) {
    if (eating) { put(4, x, 'E'); put(4, x + 1, 'W'); put(5, x, 'E'); put(5, x + 1, 'E') }
    else { put(5, x, 'E'); put(5, x + 1, 'E') }
  }
  if (eating && f % 2) { put(8, 8, 'M'); put(8, 9, 'M') }
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

export const paneStatus = (m: Meal, eating: boolean) =>
  eating ? 'nom nom nom…' : sum(m) ? 'full and napping' : 'hungry, waiting for a prompt'

export const paneFigures = (m: Meal, life: number, l: Left, eating: boolean): Figures => ({
  blocks: [
    { text: eaten(m, ' this session'), bold: true },
    { text: `${fmt(life)} lifetime · ${paneStatus(m, eating)}`, dim: true },
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

const hamsterCells = (Text: ElementConstructor<TextProps>, m: Meal, eating: boolean, f: number) =>
  halfBlocks(hamsterPixels(m, eating, f)).map((row, y) => (
    <Text>
      {row.map(c => <Text color={c.fg} backgroundColor={c.bg}>{c.ch}</Text>)}
      {y === 3 && <Text color="#F2C14E">{eating ? '  ∘ • · ∘ •'.slice(f % 4) : '  z Z z'}</Text>}
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
      const { Box, Text, Button } = $.ui.resolve(e)
      const f = eating ? await read($, frame) : 0
      return (
        <Box flexDirection="row" gap={2}>
          <Box flexDirection="column">
            {hamsterCells(Text, m, eating, f)}
          </Box>
          <Box flexDirection="column">
            <Text bold>{eaten(m)}</Text>
            <Text dimColor>{leftText(l)}</Text>
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
          {hamsterCells(Text, m, eating, f)}
          {drawFigures(Box, Text, $.ui.resolve(e).Markdown, paneFigures(m, life, l, eating))}
        </Box>
      )
    }

    const m = await read($, session)
    const eating = await read($, isEating)
    const l = await read($, left)
    const { Box, Svg, Markdown, Text } = $.ui.resolve(e)
    const figures = drawFigures(Box, Text, Markdown, paneFigures(m, await read($, lifetime), l, eating))
    return (
      <Box flexDirection="column" alignItems="center">
        <Svg
          source={hamsterSvg(m, eating)}
          alt={`A hamster, ${eating ? 'eating' : 'napping'}`}
          width={320}
          height={267}
          isInteractive
        />
        {figures}
      </Box>
    )
  })
}
