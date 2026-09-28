# grid-dashboard

YAML-driven dashboard extension for pi.

## Commands

After `/reload`, you can open it with:

- `/dashboard`
- `/grid`
- `/grid6`

You can also start with a specific block selected:

- `/dashboard 4`

## Config file

Edit:

- `~/.pi/agent/extensions/grid-dashboard/blocks.yaml`

Current supported YAML shape:

```yaml
title: Dashboard Scaffold
columns: 3
blocks:
  - id: block-1
    title: Block 1
    subtitle: Placeholder
    command: /block-1
```

Notes:

- the number of rendered blocks comes from `blocks:`
- `columns` controls how many columns are used
- rows are calculated automatically
- each block must have `title`
- supported block fields: `id`, `title`, `subtitle`, `command`

## UI behavior

- fixed-size overlay window
- type to fuzzy-search blocks
- blocks update live as the filter changes
- if there are more matching blocks than fit, the grid scrolls while keeping the same window size
- arrow keys move selection inside the filtered results
- `Enter` activates the selected block
- `Backspace` deletes one filter character
- `Ctrl+U` clears the filter
- `Esc` clears the filter, and closes the dashboard when the filter is already empty
- `q` closes the dashboard

The extension reloads `blocks.yaml` each time you run the command, so changing the YAML does not require editing the TypeScript file.
