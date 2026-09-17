// bb-plugin-synthwave-84 — backend entry.
//
// This plugin only contributes a theme; the palette lives in package.json's
// bb.themes and themes/synthwave-84.css. bb still requires a server entry, so
// the default export is a no-op.
import { type BbPluginApi } from "@get-bb/plugin-sdk";

export default function plugin(_bb: BbPluginApi) {}
