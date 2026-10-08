# Contributing

Thanks for helping the hamster. Bug reports, ideas and pull requests are welcome.

## Report a bug or ask for a feature

Open an [issue](https://github.com/valeryia-piatrova/token-hamster/issues/new/choose). For a bug, include your Claude Code version (`claude --version`), the surface (terminal, desktop, VS Code or mobile) and what the hamster showed.

## Make a change

1. Fork the repository and create a branch from `main`.
2. Run the mod from your checkout:

   ```bash
   claude --plugin-dir .
   ```

3. Check it before you open a pull request:

   ```bash
   claude plugin validate .
   ```

   ```bash
   claude plugin test .
   ```

4. Open a pull request against `main`. Changes to `main` go through a pull request and need a maintainer's approval.

Keep pull requests small and focused on one change. If you change what the hamster shows, add a screenshot or a short recording. If you publish a new version, bump `version` in both `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, since installed plugins update by version.

## Code of conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By taking part you agree to it.
