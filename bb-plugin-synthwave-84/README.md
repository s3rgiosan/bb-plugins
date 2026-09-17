# bb-plugin-synthwave-84

A [bb](https://getbb.app) plugin that adds a **Synthwave '84** theme: neon UI
chrome plus matching code-diff syntax colors.

The neon chrome applies in every appearance mode (default, light, and dark), so
the palette looks the same whichever mode is selected. Code diffs use the
Synthwave '84 syntax palette in both modes.

## Install

From the repo root:

```sh
bb plugin install ./bb-plugin-synthwave-84
```

## Activate

```sh
bb theme list                                    # find the namespaced id
bb theme set plugin:synthwave-84:synthwave-84
```

Set bb to dark mode for the intended look.

## What it contributes

- **UI chrome** — `themes/synthwave-84.css`, a CSS custom-property palette
  applied in bb's `.dark` block, plus the terminal ANSI colors.
- **Code syntax** — the bundled `synthwave-84` Shiki theme for both light and
  dark diffs.

The original VS Code theme's neon text-glow is a VS Code-specific CSS effect;
bb has no glow token, so the colors port faithfully but the glow does not.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT](../LICENSE) © Sérgio Santos
