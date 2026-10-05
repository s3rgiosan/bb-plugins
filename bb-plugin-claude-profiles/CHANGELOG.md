# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Per-thread Claude profile selection: each Claude Code thread locks to its profile's config dir on its first turn and runs with that `CLAUDE_CONFIG_DIR`, unaffected by later profile edits or removal.
- `bb claude-profile` CLI to add profiles, set project and global defaults, pick the profile for the next new thread, and lock or inspect a thread.
- Spawned threads inherit their parent thread's profile.
