# 🐹 Token Hamster

A Claude Code mod: a vector hamster in a side pane that stuffs its cheeks with every token Claude eats.

## Install

```bash
git clone <this repo> ~/mods/token-hamster
```

```bash
claude --plugin-dir ~/mods/token-hamster
```

For the desktop app, or anywhere you can't pass a flag, add the folder's path to `CLAUDE_CODE_PLUGIN_DIRS` in the `env` block of `~/.claude/settings.json`.

## Develop

```bash
claude plugin validate .
```
