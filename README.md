# ST-HiddenFloorCollapse

A SillyTavern third-party extension that automatically groups consecutive hidden messages into a magazine-style `<details>`-like fold card.

## What it does

When several consecutive chat messages are hidden from prompt (`is_system="true"`), this extension collapses them into one fold block:

```text
#20 normal message
#21 hidden
#22 hidden
#23 hidden
#24 normal message
```

becomes:

```text
#20 normal message
▶ 已隐藏 3 层 #21–#23
#24 normal message
```

Click the fold card once to expand; click it again to collapse. The original messages are not changed or deleted. This is a UI-only extension.

## Install from GitHub

1. Create a GitHub repository named `ST-HiddenFloorCollapse`.
2. Upload these files to the repository root:
   - `manifest.json`
   - `index.js`
   - `style.css`
   - `README.md`
3. In SillyTavern, open **Extensions** → **Install Extension**.
4. Paste the GitHub repo URL and install.
5. Refresh SillyTavern.

## Slash commands

```stscript
/hfc-refresh
```

Rebuild fold groups.

```stscript
/hfc-open
```

Open all hidden-message folds.

```stscript
/hfc-close
```

Close all hidden-message folds.

## Notes

- Consecutive hidden messages are grouped together.
- Hidden groups separated by normal messages become separate folds.
- This only affects display. It does not unhide messages from the prompt.
- Small system messages and tool call blocks are ignored.
