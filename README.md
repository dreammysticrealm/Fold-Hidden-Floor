# ST-HiddenFloorFold

Automatically collapses consecutive hidden SillyTavern messages into one details-like fold.

Example:

```text
#20 normal
#21 hidden
#22 hidden
#23 hidden
#24 normal
```

Becomes:

```text
#20 normal
▸ 🙈 已隐藏 3 层：#21–#23
#24 normal
```

Click the fold row to expand/collapse the hidden messages.

## Install

Put this folder here:

```text
SillyTavern/data/<your-user>/extensions/ST-HiddenFloorFold
```

Or as a global extension:

```text
SillyTavern/public/scripts/extensions/third-party/ST-HiddenFloorFold
```

Refresh SillyTavern.

If you upload this folder as a GitHub repository, it is ready to install through SillyTavern's third-party extension installer.

## Commands

```stscript
/hiddenfold on
/hiddenfold off
/hiddenfold toggle
/hiddenfold-refresh
```

Default behavior: enabled, groups closed.

## Notes

This extension only changes the UI. It does not edit chat files and does not change prompt inclusion rules.
