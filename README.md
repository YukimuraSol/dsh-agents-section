# dsh-agents-section

Render `AGENTS.md` as its own **system-prompt section** for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — re-read on every prompt assembly, instead of being pasted in as a user message.

## What it does

Project instructions (`AGENTS.md`) normally reach the model by being injected as a **user message**. This plugin registers them as a standalone **system-prompt section** instead:

- **Independent section** — the text lives in the system prompt under its own name, at its own `order`, not inside the user turn.
- **Re-read on every assembly** — the section body is a function, so `AGENTS.md` is read from disk each time the prompt is assembled. Edit the file and the next turn already sees the change; no restart, no cache to bust.
- **Per-session resolution** — the same config serves every workspace. A bare file name is resolved against the **session's own working directory**, so a session in one repo never picks up another repo's instructions.
- **Nothing to render, nothing added** — when no configured file applies to a session, the section is empty.

## Install

**From the Web UI** — Settings → Plugins → Add plugin, and paste:

```
https://github.com/YukimuraSol/dsh-agents-section
```

**From the CLI**

```bash
dsh plugin --profile <your-profile> add https://github.com/YukimuraSol/dsh-agents-section
```

Restart the instance afterwards — the Host half loads at boot.

## Configuration

The row is `agents-section`; its config is live-editable at Settings → Plugins:

```yaml
- insert:
    - id: agents-section
      name: dsh-agents-section
      config:
        order: 400
        sectionName: agents:instructions
        files:
          - AGENTS.md
```

| Option | Default | Meaning |
| --- | --- | --- |
| `order` | `400` | Position of the section in the assembled system prompt (lower comes earlier). |
| `sectionName` | `agents:instructions` | Name the section is registered under. |
| `files` | `[]` | Instruction files to render, in order. See below. |

### `files` entries

Entries come in two shapes:

- **Absolute path** (`C:\\repo\\AGENTS.md`, `/home/me/AGENTS.md`) — rendered for **every** session, regardless of where it runs. Useful for machine-wide house rules.
- **Bare file name** (`AGENTS.md`, `CONTRIBUTING.md`) — resolved **per session** against that session's working directory. The plugin walks upward from the working directory until it finds a directory containing `.git` (the project root) and renders the file from every directory on the way down. So a session in `repo/packages/api` gets `repo/AGENTS.md` *and* `repo/packages/api/AGENTS.md`; a session in a sibling workspace gets neither.

Missing, unreadable, or blank files are skipped silently. Each rendered block is prefixed with its own path, so the model can tell two files apart.

## Requirements

- DeepSeek Harness with a profile that mounts `dsh-system-prompt`.
- Node 20+.

The `@deepseek-ai/*` packages are supplied by the DSH installation itself and are declared as optional peers, so no second copy is installed.

## Notes

- This plugin only adds the section. To avoid the model receiving the same instructions twice, disable the built-in user-message injection (the `agent-instructions` rows' `maxBytes: 0`) when you rely on this section.
- The project-root marker is `.git` only. A workspace without a `.git` directory still works: the chain is then just the session's own directory.

## License

MIT
