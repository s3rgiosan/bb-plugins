import type { PluginKvStorage } from "@get-bb/plugin-sdk";

/**
 * A named Claude login. `configDir` is the `CLAUDE_CONFIG_DIR` the profile
 * logged in with; null means the machine's own login (`~/.claude`), which
 * runs with `CLAUDE_CONFIG_DIR` unset.
 */
export interface Profile {
  name: string;
  configDir: string | null;
}

/** A one-shot choice consumed by the first new thread created after `setAt`. */
export interface NextChoice {
  profile: string;
  setAt: number;
}

/**
 * The login a thread is locked to. `configDir` holds the thread's transcript
 * and credentials, so it is what stays fixed; `profile` is the name it was
 * chosen by, kept for display. Null `profile` means the machine login was
 * used without a named profile.
 */
export interface Pin {
  profile: string | null;
  configDir: string | null;
}

export type Scope = { kind: "global" } | { kind: "project"; projectId: string };

const PROFILES_KEY = "profiles";
const INSTALLED_AT_KEY = "installedAt";
const PROFILE_NAME = /^[a-z0-9][a-z0-9-]{0,31}$/;

export function isValidProfileName(name: string): boolean {
  return PROFILE_NAME.test(name);
}

function scopeKey(prefix: string, scope: Scope): string {
  return scope.kind === "global"
    ? `${prefix}.global`
    : `${prefix}.project.${scope.projectId}`;
}

export class ProfileStore {
  constructor(private readonly kv: PluginKvStorage) {}

  async profiles(): Promise<Profile[]> {
    return (await this.kv.get<Profile[]>(PROFILES_KEY)) ?? [];
  }

  async profile(name: string): Promise<Profile | undefined> {
    const profiles = await this.profiles();
    return profiles.find((profile) => profile.name === name);
  }

  async saveProfile(profile: Profile): Promise<void> {
    const profiles = await this.profiles();
    const others = profiles.filter((entry) => entry.name !== profile.name);
    await this.kv.set(PROFILES_KEY, [...others, profile]);
  }

  async removeProfile(name: string): Promise<boolean> {
    const profiles = await this.profiles();
    const remaining = profiles.filter((profile) => profile.name !== name);
    if (remaining.length === profiles.length) return false;
    await this.kv.set(PROFILES_KEY, remaining);
    return true;
  }

  async defaultProfile(scope: Scope): Promise<string | undefined> {
    return this.kv.get<string>(scopeKey("default", scope));
  }

  async setDefaultProfile(scope: Scope, name: string | null): Promise<void> {
    const key = scopeKey("default", scope);
    if (name === null) await this.kv.delete(key);
    else await this.kv.set(key, name);
  }

  async projectDefaults(): Promise<Array<{ projectId: string; profile: string }>> {
    const prefix = "default.project.";
    const keys = await this.kv.list(prefix);
    const entries = await Promise.all(
      keys.map(async (key) => ({
        projectId: key.slice(prefix.length),
        profile: await this.kv.get<string>(key),
      })),
    );
    return entries.filter(
      (entry): entry is { projectId: string; profile: string } =>
        entry.profile !== undefined,
    );
  }

  async nextChoice(scope: Scope): Promise<NextChoice | undefined> {
    return this.kv.get<NextChoice>(scopeKey("next", scope));
  }

  async setNextChoice(scope: Scope, choice: NextChoice | null): Promise<void> {
    const key = scopeKey("next", scope);
    if (choice === null) await this.kv.delete(key);
    else await this.kv.set(key, choice);
  }

  /** The login a thread is locked to, or undefined when not yet resolved. */
  async pin(threadId: string): Promise<Pin | undefined> {
    return this.kv.get<Pin>(`thread.${threadId}`);
  }

  async setPin(threadId: string, pin: Pin): Promise<void> {
    await this.kv.set(`thread.${threadId}`, pin);
  }

  /** When the plugin first loaded; older threads keep the machine login. */
  async installedAt(now: number): Promise<number> {
    const stored = await this.kv.get<number>(INSTALLED_AT_KEY);
    if (stored !== undefined) return stored;
    await this.kv.set(INSTALLED_AT_KEY, now);
    return now;
  }
}
