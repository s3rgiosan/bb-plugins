import type { PluginKvStorage } from "@get-bb/plugin-sdk";
import { beforeEach, describe, expect, it } from "vitest";
import { resolveThreadPin, type ThreadInfo } from "./resolve.js";
import { ProfileStore } from "./store.js";

function memoryKv(): PluginKvStorage {
  const rows = new Map<string, unknown>();
  return {
    get: async <T>(key: string) => rows.get(key) as T | undefined,
    set: async (key, value) => {
      rows.set(key, structuredClone(value));
    },
    delete: async (key) => {
      rows.delete(key);
    },
    list: async (prefix = "") =>
      [...rows.keys()].filter((key) => key.startsWith(prefix)),
  };
}

const INSTALLED = 1_000;
const WORK = { profile: "work", configDir: "/tmp/claude-work" };
const PERSONAL = { profile: "personal", configDir: null };
const MACHINE = { profile: null, configDir: null };

function thread(overrides: Partial<ThreadInfo> = {}): ThreadInfo {
  return {
    id: "thr-1",
    projectId: "prj-a",
    parentThreadId: null,
    createdAt: INSTALLED + 10,
    ...overrides,
  };
}

describe("resolveThreadPin", () => {
  let store: ProfileStore;

  beforeEach(async () => {
    store = new ProfileStore(memoryKv());
    await store.installedAt(INSTALLED);
    await store.saveProfile({ name: "work", configDir: "/tmp/claude-work" });
    await store.saveProfile({ name: "personal", configDir: null });
  });

  it("falls back to the machine login when nothing is configured", async () => {
    expect(await resolveThreadPin(store, thread(), 2_000)).toEqual(MACHINE);
  });

  it("uses the project default over the global default", async () => {
    await store.setDefaultProfile({ kind: "global" }, "personal");
    await store.setDefaultProfile(
      { kind: "project", projectId: "prj-a" },
      "work",
    );

    expect(await resolveThreadPin(store, thread(), 2_000)).toEqual(WORK);
    expect(
      await resolveThreadPin(
        store,
        thread({ id: "thr-2", projectId: "prj-b" }),
        2_000,
      ),
    ).toEqual(PERSONAL);
  });

  it("keeps a thread on its first login after defaults change", async () => {
    await store.setDefaultProfile({ kind: "global" }, "work");
    await resolveThreadPin(store, thread(), 2_000);
    await store.setDefaultProfile({ kind: "global" }, "personal");

    expect(await resolveThreadPin(store, thread(), 3_000)).toEqual(WORK);
  });

  it("keeps a thread on its config dir after the profile changes", async () => {
    await store.setDefaultProfile({ kind: "global" }, "work");
    await resolveThreadPin(store, thread(), 2_000);
    await store.saveProfile({ name: "work", configDir: "/tmp/claude-other" });

    expect(await resolveThreadPin(store, thread(), 3_000)).toEqual(WORK);
  });

  it("keeps a thread on its config dir after the profile is removed", async () => {
    await store.setDefaultProfile({ kind: "global" }, "work");
    await resolveThreadPin(store, thread(), 2_000);
    await store.removeProfile("work");

    expect(await resolveThreadPin(store, thread(), 3_000)).toEqual(WORK);
  });

  it("fails a new thread whose default names a removed profile", async () => {
    await store.setDefaultProfile({ kind: "global" }, "work");
    await store.removeProfile("work");

    await expect(resolveThreadPin(store, thread(), 2_000)).rejects.toThrow(
      'Unknown Claude profile "work"',
    );
    expect(await store.pin("thr-1")).toBeUndefined();
  });

  it("keeps threads created before install on the machine login", async () => {
    await store.setDefaultProfile({ kind: "global" }, "work");

    expect(
      await resolveThreadPin(store, thread({ createdAt: INSTALLED - 1 }), 2_000),
    ).toEqual(MACHINE);
  });

  it("consumes a one-shot choice for the next new thread only", async () => {
    await store.setDefaultProfile({ kind: "global" }, "personal");
    await store.setNextChoice(
      { kind: "project", projectId: "prj-a" },
      { profile: "work", setAt: INSTALLED + 5 },
    );

    expect(await resolveThreadPin(store, thread(), 2_000)).toEqual(WORK);
    expect(
      await resolveThreadPin(
        store,
        thread({ id: "thr-2", createdAt: INSTALLED + 20 }),
        2_000,
      ),
    ).toEqual(PERSONAL);
  });

  it("ignores a one-shot choice for threads older than the choice", async () => {
    await store.setNextChoice(
      { kind: "global" },
      { profile: "work", setAt: INSTALLED + 50 },
    );

    expect(await resolveThreadPin(store, thread(), 2_000)).toEqual(MACHINE);
    expect(await store.nextChoice({ kind: "global" })).toEqual({
      profile: "work",
      setAt: INSTALLED + 50,
    });
  });

  it("inherits the parent thread's login", async () => {
    await store.setPin("thr-parent", WORK);
    await store.setDefaultProfile({ kind: "global" }, "personal");

    expect(
      await resolveThreadPin(
        store,
        thread({ parentThreadId: "thr-parent" }),
        2_000,
      ),
    ).toEqual(WORK);
  });
});
