export type Meal = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export type Left = {
  context?: number
  window?: number
  cost?: number
  at?: number
  limits: { kind: string; percentLeft: number; resetsAt?: string }[]
}

export type FigureBlock =
  | { md: string }
  | { text: string; color?: string; bold?: boolean; dim?: boolean; dot?: string }
  | { head: string }
  | { bar: { label: string; share: number; value: string; color?: string } }
  | { spark: { label: string; values: number[]; value: string; color?: string } }

export type Stats = {
  turns: number
  biggest: number
  total: number
  agents: Record<string, number>
  models: Record<string, number>
  tools: Record<string, { calls: number; tokens: number }>
  recent: { tokens: number; hit: number; cost: number }[]
  lastCost: number
  pace?: { at: number; pct: number }
  context: { name: string; tokens: number; color: string }[]
}
export type Figures = { blocks: FigureBlock[] }

export type Cage = { m: Meal; l: Left; eating: boolean; key: string }

declare module 'claude-code' {
  interface PluginState {
    'token-hamster': {
      session: Meal
      lifetime: number
      isEating: boolean
      frame: number
      left: Left
      cage: Cage
      stats: Stats
    }
  }
}
