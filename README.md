# pi setup

Personal configuration for the [pi coding agent](https://www.npmjs.com/package/@earendil-works/pi-coding-agent).

## Restore on a new PC

```bash
npm install -g @earendil-works/pi-coding-agent
git clone https://github.com/Mahesh047/pi.git ~/.pi        # Windows: %USERPROFILE%\.pi
cd ~/.pi/agent/npm && npm install                           # pi packages (pi-hermes-memory, pi-web-access)
cd ~/.pi/agent/extensions/foundry-provider && npm install   # Foundry provider deps
```

Then:
- Set `ANTHROPIC_FOUNDRY_API_KEY` in your environment (used by `extensions/foundry-provider`).
- Run `pi` and `/login` for any other providers (`auth.json` is not committed).
- Tools expected on PATH: `git`, `rg`, `fd`, `fzf`.

## Not tracked
`auth.json` (credentials), `sessions/`, `projects-memory/`, SQLite DBs, `node_modules/`,
`models-store.json` (cache), `coms/` (runtime registry), and one-off task artifacts.
