import { atom, read, update } from 'claude-code'
import type { BoxProps, ElementConstructor, EngineInterface, MarkdownProps, Register, TextProps } from 'claude-code'

import type { Figures, Meal } from '../types'

const PANE = 'token-hamster'
const TITLE = 'Token Hamster'
const STORE_KEY = 'lifetime'
const EMPTY: Meal = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

const session = atom({ plugin: 'token-hamster', key: 'session' } as const, EMPTY)
const lifetime = atom({ plugin: 'token-hamster', key: 'lifetime' } as const, 0)
const isEating = atom({ plugin: 'token-hamster', key: 'isEating' } as const, false)

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

export const cacheHit = (m: Meal) => {
  const inTotal = m.input + m.cacheRead + m.cacheWrite
  return inTotal ? Math.round((m.cacheRead / inTotal) * 100) : 0
}

export const EATING = 'eating tokens…'
export const eaten = (m: Meal, suffix = '') => (sum(m) ? `${fmt(sum(m))} context tokens eaten${suffix}` : EATING)

export const statusText = (m: Meal) => (sum(m) ? `🐹 all ${fmt(sum(m))}` : `🐹 ${EATING}`)

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
  await showStatus($)
}

const showStatus = async ($: EngineInterface) => {
  $.ui.status(statusText(await read($, session)))
}

export const paneStatus = (m: Meal, eating: boolean) =>
  eating ? 'nom nom nom…' : sum(m) ? 'full and napping' : 'hungry, waiting for a prompt'

export const paneFigures = (m: Meal, life: number, eating: boolean): Figures => ({
  blocks: [
    { text: eaten(m, ' this session'), bold: true },
    { text: `${fmt(life)} lifetime · ${paneStatus(m, eating)}`, dim: true },
    { text: `cache hit ${cacheHit(m)}%`, dim: true },
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

export const register: Register = on => {

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'hamster', description: 'Open the Token Hamster pane' })
    const stored = await $.store.get(STORE_KEY)
    await update($, lifetime, () => (typeof stored === 'number' && Number.isFinite(stored) ? stored : 0))
    return next(e)
  })

  on('command.run', { command: 'hamster' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'Token Hamster pane opened.' }
  })

  on('turn.start', async ($, e, next) => {
    await update($, isEating, () => true)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.usage) await feed($, e.usage)
    if (!e.agentId) {
      await update($, isEating, () => false)
    }
    await showStatus($)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (e.surface === 'terminal') {
      const m = await read($, session)
      const life = await read($, lifetime)
      const eating = await read($, isEating)
      const { Box, Text, Markdown } = $.ui.resolve(e)
      return drawFigures(Box, Text, Markdown, paneFigures(m, life, eating))
    }

    const m = await read($, session)
    const eating = await read($, isEating)
    const { Box, Svg, Markdown, Text } = $.ui.resolve(e)
    const figures = drawFigures(Box, Text, Markdown, paneFigures(m, await read($, lifetime), eating))
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
