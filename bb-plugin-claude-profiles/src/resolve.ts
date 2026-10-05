import type { ProfileStore, Pin, Scope } from "./store.js";

export interface ThreadInfo {
  id: string;
  projectId: string;
  parentThreadId: string | null;
  createdAt: number;
}

const MACHINE_LOGIN: Pin = { profile: null, configDir: null };

/**
 * Returns the login a thread runs on and locks the thread to its config dir on
 * first resolution. Claude Code stores transcripts and credentials under the
 * config dir, so a thread stays on that dir even if its profile is later
 * edited, renamed or removed.
 *
 * Order for a thread seen for the first time: its parent's login, a pending
 * one-shot choice for the project, then globally, the project default, the
 * global default, and finally the machine login. Threads created before the
 * plugin was installed keep the machine login.
 */
export async function resolveThreadPin(
  store: ProfileStore,
  thread: ThreadInfo,
  now: number,
): Promise<Pin> {
  const pinned = await store.pin(thread.id);
  if (pinned !== undefined) return pinned;

  const chosen = await choosePin(store, thread, now);
  await store.setPin(thread.id, chosen);
  return chosen;
}

/** Builds the pin for a named profile, failing when the name is unknown. */
export async function pinForProfile(
  store: ProfileStore,
  name: string,
): Promise<Pin> {
  const profile = await store.profile(name);
  if (profile === undefined) {
    throw new Error(
      `Unknown Claude profile "${name}". Run \`bb claude-profile list\` to see configured profiles.`,
    );
  }
  return { profile: profile.name, configDir: profile.configDir };
}

async function choosePin(
  store: ProfileStore,
  thread: ThreadInfo,
  now: number,
): Promise<Pin> {
  const installedAt = await store.installedAt(now);
  if (thread.createdAt < installedAt) return MACHINE_LOGIN;

  if (thread.parentThreadId !== null) {
    const parent = await store.pin(thread.parentThreadId);
    if (parent !== undefined) return parent;
  }

  const project: Scope = { kind: "project", projectId: thread.projectId };
  const global: Scope = { kind: "global" };

  for (const scope of [project, global]) {
    const next = await store.nextChoice(scope);
    if (next !== undefined && next.setAt <= thread.createdAt) {
      const pin = await pinForProfile(store, next.profile);
      await store.setNextChoice(scope, null);
      return pin;
    }
  }

  const projectDefault = await store.defaultProfile(project);
  if (projectDefault !== undefined) return pinForProfile(store, projectDefault);

  const globalDefault = await store.defaultProfile(global);
  if (globalDefault !== undefined) return pinForProfile(store, globalDefault);

  return MACHINE_LOGIN;
}
