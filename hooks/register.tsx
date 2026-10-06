import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Meal } from '../types'

const STORE_KEY = 'lifetime'
const EMPTY: Meal = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

const session = atom({ plugin: 'token-hamster', key: 'session' } as const, EMPTY)
const lifetime = atom({ plugin: 'token-hamster', key: 'lifetime' } as const, 0)

export const sum = (m: Meal) => m.input + m.output + m.cacheRead + m.cacheWrite

export const fmt = (n: number) =>
  n >= 999_950_000 ? `${(n / 1e9).toFixed(2)}B`
  : n >= 999_950 ? `${(n / 1e6).toFixed(1)}M`
  : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k`
  : String(n)

export const EATING = 'eating tokens…'

export const statusText = (m: Meal) => (sum(m) ? `🐹 all ${fmt(sum(m))}` : `🐹 ${EATING}`)

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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const stored = await $.store.get(STORE_KEY)
    await update($, lifetime, () => (typeof stored === 'number' && Number.isFinite(stored) ? stored : 0))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.usage) await feed($, e.usage)
    await showStatus($)
    return next(e)
  })
}
