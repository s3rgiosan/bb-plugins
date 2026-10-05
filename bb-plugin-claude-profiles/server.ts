// bb-plugin-claude-profiles — backend entry.
//
// Sets CLAUDE_CONFIG_DIR for each Claude Code turn from the config dir its
// thread is locked to, so threads run under different Claude logins.
import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { registerCli } from "./src/cli.js";
import { resolveThreadPin } from "./src/resolve.js";
import { ProfileStore } from "./src/store.js";

export default async function plugin(bb: BbPluginApi) {
  const store = new ProfileStore(bb.storage.kv);
  await store.installedAt(Date.now());

  registerCli(bb, store);

  bb.providers.experimental_contributeEnv("claude-code", async (context) => {
    const thread = await bb.sdk.threads.get({ threadId: context.threadId });
    const pin = await resolveThreadPin(
      store,
      {
        id: thread.id,
        projectId: thread.projectId,
        parentThreadId: thread.parentThreadId,
        createdAt: thread.createdAt,
      },
      Date.now(),
    );
    if (pin.configDir === null) return [];

    return [
      {
        name: "CLAUDE_CONFIG_DIR",
        value: pin.configDir,
        reason: `Claude profile "${pin.profile ?? pin.configDir}"`,
      },
    ];
  });
}
