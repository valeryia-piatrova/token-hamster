import { expect, mock, test } from 'claude-code/testing'

import { cheek, fmt, halfBlocks, hamsterPixels, hamsterSvg, sceneSvg, seedColors } from '../hooks/register'

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

test('seeds follow the token mix', async () => {
  const [Y, O, G, B] = ['#F2C14E', '#E76F51', '#8AB17D', '#6C8EBF']
  expect(seedColors({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })).toEqual([Y, Y, Y, Y, Y, Y])
  expect(seedColors({ input: 0, output: 0, cacheRead: 100, cacheWrite: 0 })).toEqual([G, G, G, G, G, G])
  expect(seedColors({ input: 0, output: 50, cacheRead: 50, cacheWrite: 0 })).toEqual([O, O, O, G, G, G])
  expect(seedColors({ input: 1, output: 1, cacheRead: 1, cacheWrite: 1 })).toHaveLength(6)
  expect(seedColors({ input: 1, output: 1, cacheRead: 1, cacheWrite: 100 })).toEqual([B, B, B, B, B, B])
})

test('terminal pixel art: fixed size, puffs, chewing', async () => {
  const empty = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  const big = { input: 50_000, output: 0, cacheRead: 0, cacheWrite: 0 }
  for (const eating of [false, true]) {
    const px = hamsterPixels(big, eating, 1)
    expect(px).toHaveLength(14)
    for (const r of px) expect(r).toHaveLength(20)
    const cells = halfBlocks(px)
    expect(cells).toHaveLength(7)
    for (const r of cells) expect(r).toHaveLength(20)
  }
  expect(hamsterPixels(empty, false, 0)[7]![0]).toBe('.')
  expect(hamsterPixels(big, false, 0)[7]![0]).toBe('C')
  expect(hamsterPixels(empty, true, 1).join('')).toContain('M')
  expect(hamsterPixels(empty, true, 2).join('')).not.toContain('M')
  expect(halfBlocks(['O', 'O'])[0]![0]).toEqual({ ch: '█', fg: '#E9A96B' })
  expect(halfBlocks(['O', '.'])[0]![0]).toEqual({ ch: '▀', fg: '#E9A96B' })
  expect(halfBlocks(['.', 'O'])[0]![0]).toEqual({ ch: '▄', fg: '#E9A96B' })
  expect(halfBlocks(['.'])[0]![0]).toEqual({ ch: ' ' })
})

test('every SVG is balanced markup', async () => {
  const m = { input: 1, output: 2, cacheRead: 3, cacheWrite: 4 }
  const svgs: string[] = []
  for (const eating of [false, true]) {
    svgs.push(sceneSvg(m, eating))
    svgs.push(hamsterSvg(m, eating))
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
