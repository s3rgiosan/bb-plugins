import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import {
  PluginCliError,
  cliCommand,
  defineCli,
  type BbPluginApi,
  type PluginCliContext,
  type PluginCliResult,
} from "@get-bb/plugin-sdk";
import {
  isValidProfileName,
  type Profile,
  type ProfileStore,
  type Pin,
  type Scope,
} from "./store.js";

const DESCRIPTION = [
  "Runs Claude Code threads under different Claude logins by setting CLAUDE_CONFIG_DIR per thread.",
  "A thread locks to its profile's config dir on its first turn and keeps it; Claude Code stores transcripts under the config dir, so a thread cannot resume under another one.",
  "Profiles without --config-dir use the machine login (~/.claude).",
].join("\n");

const PROJECT_OPTION = {
  type: "string",
  placeholder: "id",
  description: "Project to scope the setting to; defaults to all projects",
} as const;

const HERE_OPTION = {
  type: "boolean",
  description: "Scope the setting to the project of the calling thread",
} as const;

const PROFILE_POSITIONAL = {
  name: "profile",
  description: "Profile name from `bb claude-profile list`",
  required: true,
} as const;

function expandPath(path: string): string {
  const expanded =
    path === "~" || path.startsWith("~/")
      ? `${homedir()}${path.slice(1)}`
      : path;
  return isAbsolute(expanded) ? expanded : resolve(expanded);
}

function describeDir(configDir: string | null): string {
  return configDir ?? "machine login (~/.claude)";
}

function describeProfile(profile: Profile): string {
  return describeDir(profile.configDir);
}

function describePin(pin: Pin): string {
  const dir = describeDir(pin.configDir);
  return pin.profile === null ? dir : `${pin.profile} (${dir})`;
}

function scopeFrom(
  options: { project?: string; here?: boolean },
  ctx: PluginCliContext,
): Scope {
  if (options.project !== undefined) {
    return { kind: "project", projectId: options.project };
  }
  if (!options.here) return { kind: "global" };
  if (ctx.projectId === undefined) {
    throw new PluginCliError("--here needs to run inside a project thread", {
      code: "invalid_value",
      hint: "Pass --project <id> instead",
    });
  }
  return { kind: "project", projectId: ctx.projectId };
}

function scopeLabel(scope: Scope): string {
  return scope.kind === "global" ? "all projects" : `project ${scope.projectId}`;
}

async function requireProfile(
  store: ProfileStore,
  name: string,
): Promise<Profile> {
  const profile = await store.profile(name);
  if (profile !== undefined) return profile;
  throw new PluginCliError(`unknown profile: ${name}`, {
    code: "invalid_value",
    hint: "Run `bb claude-profile list` to see configured profiles",
  });
}

function ok(stdout: string): PluginCliResult {
  return { exitCode: 0, stdout: `${stdout}\n` };
}

export function registerCli(
  bb: Pick<BbPluginApi, "cli">,
  store: ProfileStore,
): void {
  bb.cli.register(
    defineCli({
      name: "claude-profile",
      summary: "Choose which Claude login each thread runs on",
      description: DESCRIPTION,
      commands: {
        list: cliCommand({
          summary: "List profiles and defaults",
          run: async () => {
            const profiles = await store.profiles();
            if (profiles.length === 0) {
              return ok(
                "No profiles. Add one with `bb claude-profile add <name> --config-dir <path>`.",
              );
            }
            const globalDefault = await store.defaultProfile({ kind: "global" });
            const projectDefaults = await store.projectDefaults();
            const lines = profiles.map(
              (profile) => `${profile.name}\t${describeProfile(profile)}`,
            );
            lines.push("", `Default (all projects): ${globalDefault ?? "machine login"}`);
            for (const entry of projectDefaults) {
              lines.push(`Default (project ${entry.projectId}): ${entry.profile}`);
            }
            return ok(lines.join("\n"));
          },
        }),
        add: cliCommand({
          summary: "Add or update a profile",
          positionals: [
            {
              name: "name",
              description: "Lowercase letters, digits and dashes",
              required: true,
            },
          ],
          options: {
            "config-dir": {
              type: "string",
              placeholder: "path",
              description:
                "CLAUDE_CONFIG_DIR the profile is logged in with; omit for the machine login",
            },
          },
          run: async (input) => {
            const name = input.positionals.name;
            if (!isValidProfileName(name)) {
              throw new PluginCliError(`invalid profile name: ${name}`, {
                code: "invalid_value",
                hint: "Use up to 32 lowercase letters, digits and dashes",
              });
            }
            const configDirOption = input.options["config-dir"];
            const configDir =
              configDirOption === undefined ? null : expandPath(configDirOption);
            await store.saveProfile({ name, configDir });
            return ok(`Saved ${name}: ${describeProfile({ name, configDir })}.`);
          },
        }),
        remove: cliCommand({
          summary: "Remove a profile",
          description:
            "Threads already locked to the profile keep running on its config dir.",
          positionals: [PROFILE_POSITIONAL],
          run: async (input) => {
            const removed = await store.removeProfile(input.positionals.profile);
            if (!removed) {
              throw new PluginCliError(
                `unknown profile: ${input.positionals.profile}`,
                { code: "invalid_value" },
              );
            }
            return ok(`Removed ${input.positionals.profile}.`);
          },
        }),
        default: cliCommand({
          summary: "Set the profile new threads use",
          positionals: [
            {
              name: "profile",
              description: "Profile name; omit with --clear",
            },
          ],
          options: {
            project: PROJECT_OPTION,
            here: HERE_OPTION,
            clear: {
              type: "boolean",
              description: "Remove the default for this scope",
            },
          },
          constraints: [
            { kind: "at-most-one", options: ["project", "here"] },
          ],
          run: async (input, ctx) => {
            const scope = scopeFrom(input.options, ctx);
            if (input.options.clear) {
              await store.setDefaultProfile(scope, null);
              return ok(`Cleared the default for ${scopeLabel(scope)}.`);
            }
            const name = input.positionals.profile;
            if (name === undefined) {
              throw new PluginCliError("missing required arguments: <profile>", {
                code: "missing_required",
              });
            }
            await requireProfile(store, name);
            await store.setDefaultProfile(scope, name);
            return ok(`New threads in ${scopeLabel(scope)} use ${name}.`);
          },
        }),
        next: cliCommand({
          summary: "Use a profile for the next new thread only",
          description:
            "The choice applies to the first thread created after this command and is then cleared. A project-scoped choice wins over an all-projects one.",
          positionals: [PROFILE_POSITIONAL],
          options: {
            project: PROJECT_OPTION,
            here: HERE_OPTION,
            clear: {
              type: "boolean",
              description: "Drop a pending choice instead of setting one",
            },
          },
          constraints: [
            { kind: "at-most-one", options: ["project", "here"] },
          ],
          run: async (input, ctx) => {
            const scope = scopeFrom(input.options, ctx);
            if (input.options.clear) {
              await store.setNextChoice(scope, null);
              return ok(`Cleared the pending choice for ${scopeLabel(scope)}.`);
            }
            const name = input.positionals.profile;
            await requireProfile(store, name);
            await store.setNextChoice(scope, { profile: name, setAt: Date.now() });
            return ok(`The next new thread in ${scopeLabel(scope)} uses ${name}.`);
          },
        }),
        use: cliCommand({
          summary: "Lock a thread to a profile",
          description:
            "Run before the thread's first turn. Moving a thread that already ran to another config dir breaks its resume, so that needs --force.",
          positionals: [PROFILE_POSITIONAL],
          options: {
            thread: {
              type: "string",
              placeholder: "id",
              description: "Thread to lock; defaults to the calling thread",
            },
            force: {
              type: "boolean",
              description: "Move a thread that is already locked to another profile",
            },
          },
          run: async (input, ctx) => {
            const threadId = input.options.thread ?? ctx.threadId;
            if (threadId === undefined) {
              throw new PluginCliError("missing required option: --thread", {
                code: "missing_required",
              });
            }
            const profile = await requireProfile(store, input.positionals.profile);
            const pin: Pin = { profile: profile.name, configDir: profile.configDir };
            const current = await store.pin(threadId);
            const movesDir =
              current !== undefined && current.configDir !== pin.configDir;
            if (movesDir && !input.options.force) {
              throw new PluginCliError(
                `thread ${threadId} is locked to ${describePin(current)}`,
                {
                  code: "invalid_value",
                  hint: "Its transcript lives under that config dir; pass --force to move it anyway",
                },
              );
            }
            await store.setPin(threadId, pin);
            return ok(`Thread ${threadId} uses ${describePin(pin)}.`);
          },
        }),
        show: cliCommand({
          summary: "Show the profile a thread is locked to",
          options: {
            thread: {
              type: "string",
              placeholder: "id",
              description: "Thread to inspect; defaults to the calling thread",
            },
          },
          run: async (input, ctx) => {
            const threadId = input.options.thread ?? ctx.threadId;
            if (threadId === undefined) {
              throw new PluginCliError("missing required option: --thread", {
                code: "missing_required",
              });
            }
            const pinned = await store.pin(threadId);
            if (pinned === undefined) {
              return ok(`Thread ${threadId} is not locked yet; it locks on its first turn.`);
            }
            return ok(`Thread ${threadId} uses ${describePin(pinned)}.`);
          },
        }),
      },
    }),
  );
}
