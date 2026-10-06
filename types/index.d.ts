export type Meal = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
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
    }
  }
}
