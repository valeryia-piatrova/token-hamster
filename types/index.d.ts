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

export type Figures = { blocks: FigureBlock[] }

declare module 'claude-code' {
  interface PluginState {
    'token-hamster': {
      session: Meal
      lifetime: number
      isEating: boolean
      frame: number
      left: Left
    }
  }
}
