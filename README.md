# ST-HiddenFloorCollapse

中文 | [English](#english)

一个SillyTavern第三方扩展，用来把连续隐藏的聊天楼层自动合并成一个可展开/折叠的杂志风折叠块。

## 功能

当聊天里有连续多条被隐藏的消息时，本扩展会把它们合并成一个折叠块：

```text
#20 正常消息
#21 hidden
#22 hidden
#23 hidden
#24 正常消息
```

会显示成：

```text
#20 正常消息

▶ 已隐藏3层 #21–#23

#24 正常消息
```

点一下折叠块会展开这些隐藏楼层，再点一下会重新折叠。原消息不会被删除，也不会被取消隐藏。本扩展只改变聊天界面的显示方式。

## 适合什么场景

* 你经常用Hide from prompt隐藏旧楼层
* 你想让隐藏楼层不占据大量屏幕空间
* 你仍然希望随时点开查看被隐藏的原文
* 你希望连续隐藏楼层合并成一组，而不是每层单独折叠

## 安装

1. 打开SillyTavern。
2. 进入Extensions。
3. 选择Install Extension。
4. 粘贴本仓库地址。
5. 安装后刷新SillyTavern页面。

也可以手动安装：把本仓库放到SillyTavern的第三方扩展目录中，然后刷新页面。

## 使用

安装后无需额外设置。插件会自动扫描聊天界面，把连续的隐藏消息合并成折叠块。

隐藏消息通常来自SillyTavern的Hide from prompt/眼睛按钮，或等价的隐藏命令。只要消息在界面上带有隐藏状态，插件就会自动处理。

## 命令

```stscript
/hfc-refresh
```

重新扫描并重建隐藏楼层折叠组。

```stscript
/hfc-open
```

展开所有隐藏楼层折叠组。

```stscript
/hfc-close
```

折叠所有隐藏楼层折叠组。

## 说明

* 只有连续的隐藏消息会被合并成一组。
* 中间隔着正常消息时，会分成多个折叠组。
* 插件只影响界面显示，不会修改聊天文件。
* 插件不会把隐藏消息重新加入prompt。
* 小型系统消息和工具调用消息会被跳过。
* 折叠块使用SillyTavern主题色，并带有杂志风排版。

## English

A SillyTavern third-party extension that automatically groups consecutive hidden chat messages into a magazine-style fold card.

## Features

When several consecutive chat messages are hidden, this extension turns them into one collapsible block:

```text
#20 normal message
#21 hidden
#22 hidden
#23 hidden
#24 normal message
```

It becomes:

```text
#20 normal message

▶ 已隐藏3层 #21–#23

#24 normal message
```

Click the fold card once to expand the hidden messages. Click it again to collapse them. The original messages are not deleted, edited, or unhidden. This extension only changes how hidden messages are displayed in the chat UI.

## Use cases

* You often useHide from promptto hide old messages
* You want hidden messages to take less vertical space
* You still want to expand and read hidden messages when needed
* You want consecutive hidden messages to become one group instead of many separate folds

## Installation

1. OpenSillyTavern.
2. Go toExtensions.
3. ChooseInstall Extension.
4. Paste this repository URL.
5. Install and refreshSillyTavern.

Manual installation also works: place this repository in yourSillyTavernthird-party extensions folder, then refresh the page.

## Usage

No setup is required after installation. The extension automatically scans the chat and groups consecutive hidden messages.

Hidden messages usually come fromSillyTavern’sHide from prompt/eye button, or an equivalent hide command. As long as the message is marked hidden in the chat UI, the extension will process it.

## Slash commands

```stscript
/hfc-refresh
```

Rebuild hidden-message fold groups.

```stscript
/hfc-open
```

Open all hidden-message fold groups.

```stscript
/hfc-close
```

Close all hidden-message fold groups.

## Notes

* Consecutive hidden messages are grouped together.
* Hidden groups separated by normal messages become separate folds.
* This extension only affects display.
* It does not edit chat files.
* It does not unhide messages from the prompt.
* Small system messages and tool-call blocks are ignored.
* The fold card usesSillyTaverntheme colors with a magazine-style layout.
