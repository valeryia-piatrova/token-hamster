export type Meal = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

declare module 'claude-code' {
  interface PluginState {
    'token-hamster': {
      session: Meal
      lifetime: number
    }
  }
}
