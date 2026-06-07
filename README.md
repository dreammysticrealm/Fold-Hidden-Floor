# Fold Hidden Floor

A small SillyTavern extension that automatically collapses consecutive hidden chat messages into magazine-style folds.

适用于 SillyTavern 里被 **Hide from prompt / `/hide`** 标记的楼层。  
如果连续好几层都被 hidden，它们会被合并成一个折叠块，而不是一层一层占屏幕空间。

## Preview

Before:

```text
#20 normal
#21 hidden
#22 hidden
#23 hidden
#24 normal
#25 hidden
#26 normal
```

After:

```text
#20 normal

HIDDEN   3 hidden floors                         #21 — #23
         “Preview text from the first hidden floor..."
         Character × 2 · User × 1                ＋ 展开

#24 normal

HIDDEN   1 hidden floor                          #25
         “Preview text from the hidden floor...” ＋ 展开

#26 normal
```

Click the fold row to expand or collapse the hidden messages.

## Features

- Automatically detects hidden SillyTavern messages.
- Consecutive hidden messages are grouped into one fold.
- Non-consecutive hidden messages become separate folds.
- Native `<details>` behavior for click-to-expand.
- Magazine-style visual design instead of bubble-style design.
- Does not edit chat files.
- Does not change prompt inclusion rules.
- Works as a normal third-party SillyTavern extension.

## Install

### Install through SillyTavern

1. Open **Extensions** in SillyTavern.
2. Open **Install extension / Third-party extensions**.
3. Paste this repository URL:

```text
https://github.com/dreammysticrealm/Fold-Hidden-Floor
```

4. Click **Install**.
5. Refresh SillyTavern.

After refreshing, the extension should start working automatically.

## Commands

You can use these slash commands in the chat input:

```stscript
/hiddenfold on
```

Enable automatic folding.

```stscript
/hiddenfold off
```

Disable automatic folding.

```stscript
/hiddenfold toggle
```

Toggle folding on/off.

```stscript
/hiddenfold-refresh
```

Manually refresh hidden message folds.

## Quick Reply example

You can create a Quick Reply button to toggle the extension:

```stscript
/qr-create label=🙈折叠隐藏 /hiddenfold toggle
```

## Manual install

If you do not want to use the extension installer, download this repository and put the folder here:

```text
SillyTavern/data/<your-user>/extensions/Fold-Hidden-Floor
```

Or as a global extension:

```text
SillyTavern/public/scripts/extensions/third-party/Fold-Hidden-Floor
```

Then refresh SillyTavern.

## Notes

This extension is UI-only.

It only changes how hidden messages are displayed on screen.  
It does not unhide messages, delete messages, modify chat history, or change what goes into the prompt.

Hidden messages are still hidden from prompt according to SillyTavern’s own behavior.

## Troubleshooting

If the extension does not load:

1. Make sure the repository root contains these files directly:

```text
manifest.json
index.js
style.css
README.md
```

2. Make sure they are not inside an extra nested folder.
3. Refresh SillyTavern after installing.
4. Try this command in chat:

```stscript
/hiddenfold on
```

If SillyTavern says the command is unknown, the extension probably did not load.
