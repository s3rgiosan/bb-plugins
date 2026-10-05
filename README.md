# bb-plugins

A monorepo of plugins for [bb](https://getbb.app), the agentic IDE.

## Plugins

- **[bb-plugin-synthwave-84](./bb-plugin-synthwave-84)** — a Synthwave '84 theme:
  neon UI chrome plus matching code-diff syntax colors (applies in every mode).
- **[bb-plugin-claude-profiles](./bb-plugin-claude-profiles)** — runs threads
  under different Claude logins (e.g. personal and work), chosen per thread or
  per project.

## Install a plugin

From the repo root:

```sh
bb plugin install ./bb-plugin-synthwave-84
```

`.bb/plugins.json` indexes the plugin directories in this repo.

## License

[MIT](./LICENSE) © Sérgio Santos
