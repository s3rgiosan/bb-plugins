# bb-plugin-claude-profiles

A [bb](https://getbb.app) plugin that runs Claude Code threads under different
Claude logins, for example a personal and a work account. A profile is a named
Claude Code config dir; each thread is locked to one profile and the plugin sets
`CLAUDE_CONFIG_DIR` for that thread's turns.

## Requirements

- bb 0.45 or later.
- One Claude Code config dir per profile, each already logged in:

  ```sh
  CLAUDE_CONFIG_DIR=~/.claude-work claude   # then /login with the work account
  ```

  The machine login (`~/.claude`) can serve as one of the profiles.
- The bundled Account Pooler disabled, or routing turned off with
  `bb pool routing claude --off`. The pooler replaces Claude's credentials for
  routed threads.

## Install

From the repo root:

```sh
bb plugin install ./bb-plugin-claude-profiles
```

## Set up profiles

```sh
bb claude-profile add personal                          # machine login (~/.claude)
bb claude-profile add work --config-dir ~/.claude-work
bb claude-profile list
```

Paths are resolved on the bb server's machine. Use absolute paths when threads
run on a remote host.

## Choose a profile

A thread locks to its profile's config dir on its first turn and keeps it.
Claude Code stores transcripts and credentials under the config dir, so the
thread stays on that dir even if the profile is later edited, renamed or
removed. Moving a config dir on disk breaks resume for its threads; re-lock
them with `bb claude-profile use <profile> --thread <id> --force`.

For a new thread, the profile is the first match of:

1. The parent thread's profile, for threads spawned by another thread.
2. A one-shot choice set with `bb claude-profile next`.
3. The project default.
4. The default for all projects.
5. The machine login.

```sh
# Every new thread in a project
bb claude-profile default work --project <project-id>

# Every new thread in all other projects
bb claude-profile default personal

# Only the next new thread
bb claude-profile next work

# Lock a specific thread before its first turn
bb claude-profile use work --thread <thread-id>

# Inspect a thread
bb claude-profile show --thread <thread-id>
```

Inside a thread, `--here` scopes `default` and `next` to that thread's project,
and `use`/`show` default to the calling thread.

Threads created before the plugin was installed keep the machine login.

## Limitations

- `bb.providers.experimental_contributeEnv` is an experimental bb API and may
  change between releases.
- bb's usage display and Skills page read `~/.claude` regardless of the
  thread's profile
  ([#3607](https://github.com/get-bb/bb/issues/3607),
  [#3925](https://github.com/get-bb/bb/issues/3925)).
- A new thread whose default or one-shot choice names a removed profile fails
  its first turn until the profile is added again or the default is changed.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT](../LICENSE) © Sérgio Santos
