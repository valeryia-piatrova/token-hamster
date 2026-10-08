import { expect, mock, test } from 'claude-code/testing'

import { cacheHit, cheek, fmt, halfBlocks, hamsterPixels, hamsterSvg, leftText, mood, moodText, paneWheelSvg, sceneSvg, seedColors, statusText, until, addTurn, forecast, spark, NO_STATS } from '../hooks/register'

const PANE = {
  component: 'Pane',
  requestId: 'token-hamster',
  props: { title: 'Token Hamster', isFocused: false, bodyColumns: 60, placement: 'dock' },
} as const

test('helpers', async () => {
  expect(fmt(999)).toBe('999')
  expect(fmt(12_345)).toBe('12.3k')
  expect(fmt(3_400_000)).toBe('3.4M')
  expect(fmt(999_950)).toBe('1.0M')
  expect(fmt(999_950_000)).toBe('1.00B')
  expect(cheek(0)).toBe(1)
  expect(cheek(1e12)).toBe(1.8)
  expect(seedColors({ input: 0, output: 0, cacheRead: 100, cacheWrite: 0 })).toHaveLength(6)
  const svg = sceneSvg({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, false, { limits: [{ kind: '<x&y>', percentLeft: 90 }] })
  expect(svg).toContain('&#60;x&#38;y&#62; 90%')
})

test('mood follows the emptiest limit', async () => {
  const w = (percentLeft: number) => ({ limits: [{ kind: 'five_hour', percentLeft, resetsAt: '1970-01-01T02:30:00Z' }] })
  expect(mood({ limits: [] })).toBe('fine')
  expect(mood(w(51))).toBe('fine')
  expect(mood(w(50))).toBe('worried')
  expect(mood(w(26))).toBe('worried')
  expect(mood(w(25))).toBe('running')
  expect(mood(w(0))).toBe('empty')
  expect(moodText(w(10), 0)).toBe('a quarter left, running it off · refill in 2h 30m')
  expect(moodText(w(0), 0)).toBe('out of food, asleep in the house · refill in 2h 30m')
  expect(until('1970-01-08T03:00:00Z', 0)).toBe('7d 3h')
  expect(until('1970-01-01T00:00:00Z', 1)).toBe('')
  expect(cacheHit({ input: 32, output: 293, cacheRead: 1_200_000, cacheWrite: 48_600 })).toBe(96)
  expect(statusText({ input: 1000, output: 0, cacheRead: 0, cacheWrite: 0 }, { cost: 0.8, ...w(85) })).toBe('🐹 all 1.0k · session 85% · credits $0.80')
})

const usage = (input: number, output: number, cacheRead: number) => ({
  model: 'claude-opus-5-5',
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: cacheRead,
  cache_creation_input_tokens: 0,
})

test('a finished turn feeds the hamster its usage, on every surface', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  on('turn.complete', (_$, e) => ({ text: e.answer, usage: e.usage }))
  await $.turn.complete({
    answer: 'hi', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer',
    usage: usage(1000, 500, 10_000),
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'token-hamster', surface, ...PANE } as never)
    expect(await ui.find({ text: /11\.5k context tokens eaten/ })).toBeDefined()
    await ui.unmount()
  }
})

test('the band shows the habitat and opens the pane', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  const opened: string[] = []
  on('ui.open', (_$, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true as const } }
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'token-hamster',
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, bodyColumns: 80 },
    } as never)
    expect(await ui.find({ key: 'details' })).toBeDefined()
    await ui.press({ key: 'details' })
    await ui.unmount()
  }
  expect(opened).toEqual(['token-hamster', 'token-hamster'])
})

test('the pane shows what is left of the context and the plan', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { tokens: 65_000, window: 1_000_000, percent: 7 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 12 },
        { kind: 'seven_day', percentUsed: 3 },
      ],
      cost: { usd: 0.8 },
    },
  }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  expect(leftText({ limits: [] })).toBe('')
  await $.turn.complete({ answer: 'hi', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'token-hamster', surface, ...PANE } as never)
    expect(await ui.find({ text: /Session limit: 88% left/ })).toBeDefined()
    expect(await ui.find({ text: /935\.0k left/ })).toBeDefined()
    expect(await ui.find({ text: /\$0\.80/ })).toBeDefined()
    await ui.unmount()
  }
})

const PANE_TERM = { plugin: 'token-hamster', surface: 'terminal', ...PANE } as never
const PANE_DESK = { plugin: 'token-hamster', surface: 'desktop', ...PANE } as never
const BAND = (surface: 'terminal' | 'desktop', hasSurvey = false) =>
  ({ plugin: 'token-hamster', surface, component: 'AbovePrompt', props: { hasSurvey, isWorking: false, bodyColumns: 80 } }) as never
const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const
const engine = (on: any, { status = true } = {}) => {
  on('session.start', (_$: unknown, e: any) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { isRegistered: true } }))
  on('turn.start', (_$: unknown, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_$: unknown, e: any) => ({ text: e.answer }))
  if (status) on('ui.status', () => ({ value: undefined }))
}
const finishTurn = ($: any, turnId: string, u: object | undefined = usage(1000, 500, 10_000), extra: object = {}) =>
  $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId, reason: 'answer', usage: u, ...extra })

test('pure helpers: edges', async () => {
  expect(fmt(0)).toBe('0')
  expect(fmt(1000)).toBe('1.0k')
  expect(fmt(999_949)).toBe('999.9k')
  expect(until(undefined, 0)).toBe('')
  expect(until('not a date', 0)).toBe('')
  expect(until('1970-01-01T00:59:00Z', 0)).toBe('0h 59m')
  expect(until('1970-01-02T00:00:00Z', 0)).toBe('1d 0h')
  const l = { limits: [
    { kind: 'seven_day', percentLeft: 40, resetsAt: '1970-01-05T00:00:00Z' },
    { kind: 'five_hour', percentLeft: 10, resetsAt: '1970-01-01T01:00:00Z' },
  ] }
  expect(mood(l)).toBe('running')
  expect(moodText(l, 0)).toBe('a quarter left, running it off · refill in 1h 0m')
  expect(moodText({ limits: [{ kind: 'five_hour', percentLeft: 30 }] }, 0)).toBe('half the stash is gone')
  expect(moodText({ limits: [{ kind: 'five_hour', percentLeft: 90 }] }, 0)).toBe('')
  expect(leftText({ context: 1500, limits: [{ kind: 'five_hour', percentLeft: 88 }, { kind: 'other', percentLeft: 5 }] }))
    .toBe('1.5k context left · session 88% · other 5%')
  expect(cacheHit({ input: 0, output: 99, cacheRead: 0, cacheWrite: 0 })).toBe(0)
  expect(statusText({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, { limits: [] })).toBe('🐹 eating tokens…')
  expect(cheek(10_000)).toBeGreaterThan(1.35)
  expect(cheek(7_000)).toBeLessThan(1.35)
})

test('seeds follow the token mix', async () => {
  const [Y, O, G, B] = ['#F2C14E', '#E76F51', '#8AB17D', '#6C8EBF']
  expect(seedColors({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })).toEqual([Y, Y, Y, Y, Y, Y])
  expect(seedColors({ input: 0, output: 0, cacheRead: 100, cacheWrite: 0 })).toEqual([G, G, G, G, G, G])
  expect(seedColors({ input: 0, output: 50, cacheRead: 50, cacheWrite: 0 })).toEqual([O, O, O, G, G, G])
  expect(seedColors({ input: 1, output: 1, cacheRead: 1, cacheWrite: 1 })).toHaveLength(6)
  expect(seedColors({ input: 1, output: 1, cacheRead: 1, cacheWrite: 100 })).toEqual([B, B, B, B, B, B])
})

test('terminal pixel art: fixed size, puffs, moods', async () => {
  const empty = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  const big = { input: 50_000, output: 0, cacheRead: 0, cacheWrite: 0 }
  for (const md of ['fine', 'worried', 'running', 'empty'] as const) {
    for (const eating of [false, true]) {
      const px = hamsterPixels(big, eating, 1, md)
      expect(px).toHaveLength(14)
      for (const r of px) expect(r).toHaveLength(20)
      const cells = halfBlocks(px)
      expect(cells).toHaveLength(7)
      for (const r of cells) expect(r).toHaveLength(20)
    }
  }
  expect(hamsterPixels(empty, false, 0)[7]![0]).toBe('.')
  expect(hamsterPixels(big, false, 0)[7]![0]).toBe('C')
  expect(hamsterPixels(empty, true, 1).join('')).toContain('M')
  expect(hamsterPixels(empty, true, 2).join('')).not.toContain('M')
  expect(hamsterPixels(empty, false, 0, 'fine').join('')).not.toContain('D')
  expect(hamsterPixels(empty, false, 0, 'worried').join('')).toContain('D')
  expect(halfBlocks(['O', 'O'])[0]![0]).toEqual({ ch: '█', fg: '#E9A96B' })
  expect(halfBlocks(['O', '.'])[0]![0]).toEqual({ ch: '▀', fg: '#E9A96B' })
  expect(halfBlocks(['.', 'O'])[0]![0]).toEqual({ ch: '▄', fg: '#E9A96B' })
  expect(halfBlocks(['.'])[0]![0]).toEqual({ ch: ' ' })
})

test('every SVG is balanced markup in every mood', async () => {
  const m = { input: 1, output: 2, cacheRead: 3, cacheWrite: 4 }
  const lim = (p: number) => ({ context: 10, window: 100, limits: [{ kind: 'five_hour', percentLeft: p }] })
  const svgs = [paneWheelSvg()]
  for (const p of [90, 40, 10, 0]) for (const eating of [false, true]) {
    svgs.push(sceneSvg(m, eating, lim(p), 0))
    svgs.push(hamsterSvg(m, eating, mood(lim(p))))
  }
  for (const s of svgs) {
    const stack: string[] = []
    for (const [, close, name = "", self] of s.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
      if (self) continue
      if (close) expect(stack.pop()).toBe(name)
      else stack.push(name)
    }
    expect(stack).toEqual([])
    expect(s).not.toContain('NaN')
    expect(s).not.toContain('undefined')
  }
})

test('lifetime survives sessions and a corrupt store', async ($, on) => {
  const saved: unknown[] = []
  on('store.get', () => ({ value: 2_000_000 }))
  on('store.set', (_$, e: any) => { saved.push(e.value); return { value: undefined } })
  mock.clock(on)
  engine(on)
  await $.session.start(START)
  await finishTurn($, 't1')
  const ui = await $.ui.mount(PANE_TERM)
  expect(await ui.find({ text: /2\.0M lifetime/ })).toBeDefined()
  await ui.unmount()
  expect(saved.at(-1)).toBe(2_011_500)
})

test('lifetime adds to what another session stored meanwhile', async ($, on) => {
  let stored: unknown = 1000
  on('store.get', () => ({ value: stored }))
  on('store.set', (_$, e: any) => { stored = e.value; return { value: undefined } })
  mock.clock(on)
  engine(on)
  await $.session.start(START)
  stored = 5000
  await finishTurn($, 't1')
  expect(stored).toBe(16_500)
})

test('a corrupt stored lifetime starts from zero', async ($, on) => {
  mock.store(on, { lifetime: 'lots' })
  mock.clock(on)
  engine(on)
  await $.session.start(START)
  const ui = await $.ui.mount(PANE_TERM)
  expect(await ui.find({ text: /^0 lifetime/ })).toBeDefined()
  expect(await ui.find({ text: /hungry, waiting for a prompt/ })).toBeDefined()
  await ui.unmount()
})

test('eats while the main turn runs, naps after; subagents do not end the meal', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on)
  engine(on)
  const done = (extra: object) => $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', ...extra } as never)

  await $.turn.start({ text: 'hi', turnId: 't1' })
  let ui = await $.ui.mount(PANE_DESK)
  expect(await ui.find({ text: /nom nom nom/ })).toBeDefined()
  expect(JSON.stringify(await ui.drawn())).toContain('animateMotion')
  await ui.unmount()

  ui = await $.ui.mount(PANE_TERM)
  const before = JSON.stringify(await ui.drawn())
  await clock.advance(300)
  expect(JSON.stringify(await ui.drawn())).not.toBe(before)
  await ui.unmount()

  await done({ agentId: 'sub-1' })
  ui = await $.ui.mount(PANE_TERM)
  expect(await ui.find({ text: /nom nom nom/ })).toBeDefined()
  await ui.unmount()

  await done({ isAborted: true, reason: 'aborted', usage: usage(1000, 500, 10_000) })
  ui = await $.ui.mount(PANE_TERM)
  expect(await ui.find({ text: /full and napping/ })).toBeDefined()
  await ui.unmount()
})

test('a failing usage reading never breaks the turn and keeps the last one', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  engine(on)
  let fail = false
  on('session.usage', () => {
    if (fail) throw new Error('offline')
    return { value: { startedAt: 0, context: { tokens: 0, window: 1000, percent: 0 }, rateLimits: [{ kind: 'five_hour', percentUsed: 40 }] } }
  })
  await finishTurn($, 't1')
  fail = true
  const r = await finishTurn($, 't2', usage(1000, 500, 10_000), { answer: 'ok' })
  expect(r.text).toBe('ok')
  const ui = await $.ui.mount(PANE_TERM)
  expect(await ui.find({ text: /Session limit: 60% left/ })).toBeDefined()
  expect(await ui.find({ text: /23\.0k context tokens eaten/ })).toBeDefined()
  await ui.unmount()
})

test('a quarter left: the hamster runs in its wheel; out of food: asleep in its house', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  engine(on)
  let used = 80
  on('session.usage', () => ({
    value: { startedAt: 0, context: { tokens: 0, window: 1000, percent: 0 }, rateLimits: [{ kind: 'five_hour', percentUsed: used, resetsAt: '1970-01-01T01:30:00Z' }] },
  }))
  await $.session.start(START)
  let ui = await $.ui.mount(PANE_DESK)
  expect(JSON.stringify(await ui.drawn())).toContain('running in its wheel')
  await ui.unmount()
  ui = await $.ui.mount(BAND('terminal'))
  expect(await ui.find({ text: /a quarter left, running it off · refill in 1h 30m/ })).toBeDefined()
  await ui.unmount()

  used = 100
  await finishTurn($, 't1')
  ui = await $.ui.mount(PANE_DESK)
  const tree = JSON.stringify(await ui.drawn())
  expect(tree).toContain('asleep in its house')
  expect(tree).not.toContain('running in its wheel')
  await ui.unmount()
  ui = await $.ui.mount(BAND('terminal'))
  expect(await ui.find({ text: /out of food, asleep in the house · refill in 1h 30m/ })).toBeDefined()
  await ui.unmount()
})

test('the status line counts what was eaten', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  const lines: (string | undefined)[] = []
  engine(on, { status: false })
  on('ui.status', (_$, e: any) => { lines.push(e.text); return { value: undefined } })
  await finishTurn($, 't1')
  expect(lines.at(-1)).toBe('🐹 all 11.5k')
})

test('/hamster opens the pane', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  engine(on)
  const opened: string[] = []
  on('ui.open', (_$, e) => { opened.push(e.id); return { value: { isPlaced: true as const } } })
  await $.session.start(START)
  const r = await $.command.run({ command: 'hamster', args: '' } as never)
  expect(r).toEqual(expect.objectContaining({ text: 'Token Hamster pane opened.' }))
  expect(opened).toEqual(['token-hamster'])
})

test('the band steps aside for a survey', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  engine(on)
  on('ui.render', ($, e) => { const { Box } = $.ui.resolve(e as never) as any; return <Box key="engine-band" /> })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount(BAND(surface, true))
    expect(await ui.find({ key: 'details' })).toBeUndefined()
    expect(await ui.find({ key: 'engine-band' })).toBeDefined()
    await ui.unmount()
  }
})

test('more tokens change the figures, not the animated cage (no reload, no flicker)', async () => {
  const l = { context: 960_000, window: 1_000_000, at: 0, limits: [{ kind: 'five_hour', percentLeft: 62 }] }
  const a = { input: 10, output: 682, cacheRead: 300_600, cacheWrite: 22_900 }
  const b = { ...a, output: a.output + 400, cacheRead: a.cacheRead + 9_000 }
  const nextStep = { ...l, context: l.context - 9_400 }
  expect(sceneSvg(b, true, nextStep, false)).toBe(sceneSvg(a, true, l, false))
  expect(hamsterSvg(b, true)).toBe(hamsterSvg(a, true))
  expect(leftText(nextStep)).not.toBe(leftText(l))
})

test('the band swaps its SVG only when the meal starts and ends, the counts with it', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  engine(on)
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 40_000, window: 1_000_000 }, rateLimits: [{ kind: 'five_hour', percentUsed: 38 }] } }))
  const ui = await $.ui.mount({ plugin: 'token-hamster', surface: 'desktop', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, bodyColumns: 120 } } as never)
  const cages = async () => {
    const found: string[] = []
    const walk = (n: any) => {
      if (!n || typeof n !== 'object') return
      if (n.type === 'Svg') found.push(n.props.source)
      for (const c of [].concat(n.props?.children ?? n.children ?? [])) walk(c)
    }
    walk(await ui.drawn())
    return found
  }
  const napping = await cages()
  expect(napping).toHaveLength(1)
  await $.turn.start({ text: 'hi', turnId: 't1' })
  const eating = await cages()
  expect(eating).not.toEqual(napping)
  expect(await ui.find({ text: /^## eating tokens…/ })).toBeDefined()
  expect(await ui.find({ text: /0 (context )?tokens eaten/ })).toBeUndefined()
  expect(await ui.find({ text: /\*\*\*\*/ })).toBeUndefined()
  await finishTurn($, 't1', usage(10, 400, 9_000))
  expect(await cages()).not.toEqual(eating)
  expect(await ui.find({ text: /9\.4k context tokens eaten/ })).toBeDefined()
  await ui.unmount()
})

test('stats: pure pieces', async () => {
  expect(spark([1, 2, 4, 8])).toBe('▂▃▅█')
  expect(spark([0, 0])).toBe('▁▁')
  const l = (pct: number, at: number) => ({ at, cost: 1, limits: [{ kind: 'five_hour', percentLeft: pct, resetsAt: new Date(at + 4 * 3.6e6).toISOString() }] })
  let st = addTurn(NO_STATS, { tokens: 1000, who: 'main', model: 'claude-opus-5-5', tools: { Bash: 2 }, hit: 90, l: l(80, 0) })
  st = addTurn(st, { tokens: 3000, who: 'Explore', model: 'claude-haiku-4-5', tools: { Read: 1 }, hit: 50, l: l(80, 0) })
  st = addTurn(st, { tokens: 2000, who: 'main', model: 'claude-opus-5-5', tools: { Bash: 1 }, hit: 95, l: l(70, 3.6e6) })
  expect(st.turns).toBe(2)
  expect(st.biggest).toBe(2000)
  expect(st.agents).toEqual({ main: 3000, Explore: 3000 })
  expect(st.models).toEqual({ 'opus-5-5': 3000, 'haiku-4-5': 3000 })
  expect(st.tools.Bash).toEqual({ calls: 3, tokens: 3000 })
  expect(forecast(st, l(70, 3.6e6))).toBe('at this pace the session limit lasts until it resets')
  const fast = addTurn(NO_STATS, { tokens: 1, who: 'main', tools: {}, hit: 0, l: l(80, 0) })
  expect(forecast(fast, l(40, 3.6e6))).toBe('at this pace the session limit runs out in ~1h 0m')
  expect(addTurn(fast, { tokens: 1, who: 'main', tools: {}, hit: 0, l: l(100, 5 * 3.6e6) }).pace).toEqual({ at: 5 * 3.6e6, pct: 100 })
})

test('stats: the pane shows context, pace, who spends, tools and models after turns', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  engine(on)
  on('session.usage', (_$, e: any) => ({
    value: {
      startedAt: 0,
      context: {
        tokens: 65_000, window: 1_000_000,
        ...(e?.breakdown ? { breakdown: { categories: [
          { name: 'System tools', tokens: 28_000, color: 'promptBorder', isDeferred: false, kind: 'used' },
          { name: 'Messages', tokens: 4_000, color: 'purple', isDeferred: false, kind: 'used' },
          { name: 'Free space', tokens: 900_000, color: 'inactive', isDeferred: false, kind: 'free' },
        ] } } : {}),
      },
      rateLimits: [{ kind: 'five_hour', percentUsed: 20 }],
    },
  }) as never)
  on('agent.list', () => ({ value: [{ id: 'a1', type: 'Explore', description: 'look around', status: 'completed' }] }) as never)
  on('tool.call', () => ({ result: {}, text: 'ok' }) as never)
  await $.tool.call({ tool: 'Bash', input: { command: 'ls' } } as never)
  await $.tool.call({ tool: 'Bash', input: { command: 'pwd' } } as never)
  await finishTurn($, 't1')
  await finishTurn($, 'a1-turn', usage(100, 100, 3_000), { agentId: 'a1' })
  const ui = await $.ui.mount(PANE_TERM)
  for (const t of [/What fills the context/, /System tools/, /Pace/, /1 turns · biggest 11\.5k/, /Who spends/, /Explore/, /Tools/, /Bash/, /2× · 11\.5k/, /Models/, /opus-5-5/, /cache hit/]) {
    expect(await ui.find({ text: t })).toBeDefined()
  }
  expect(await ui.find({ text: /Free space/ })).toBeUndefined()
  await ui.unmount()
})
