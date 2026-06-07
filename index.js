import {
    chat,
    chatElement,
    eventSource,
    event_types,
    systemUserName,
} from '/script.js';

import {
    extension_settings,
    saveSettingsDebounced,
} from '/scripts/extensions.js';

import { SlashCommandParser } from '/scripts/slash-commands/SlashCommandParser.js';

const MODULE_NAME = 'hiddenFloorFold';
const SUMMARY_CLASS = 'hff-summary';
const MESSAGE_MARKER_CLASS = 'hff-hidden-message';
const COLLAPSED_CLASS = 'hff-hidden-collapsed';
const OPEN_CLASS = 'hff-open';

const DEFAULT_SETTINGS = {
    enabled: true,
    defaultOpen: false,
    previewChars: 72,
    excludeSmallSystem: true,
    excludeSillyTavernSystem: true,
};

let observer = null;
let scheduled = false;
let applying = false;

/** @type {Set<string>} */
const openGroups = new Set();

function getSettings() {
    extension_settings[MODULE_NAME] ??= {};
    Object.assign(extension_settings[MODULE_NAME], {
        ...DEFAULT_SETTINGS,
        ...extension_settings[MODULE_NAME],
    });
    return extension_settings[MODULE_NAME];
}

function saveSettings() {
    saveSettingsDebounced?.();
}

function getChatRoot() {
    return chatElement?.[0] ?? document.getElementById('chat');
}

function getMessageId(el) {
    const value = Number(el?.getAttribute?.('mesid'));
    return Number.isInteger(value) ? value : null;
}

function getMessageForElement(el) {
    const id = getMessageId(el);
    return id === null ? null : chat[id];
}

function normalizeText(text, maxLength = 72) {
    const normalized = String(text ?? '')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (!normalized) return '';
    return normalized.length > maxLength
        ? `${normalized.slice(0, maxLength)}…`
        : normalized;
}

function isFoldableHiddenMessage(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (!el.classList.contains('mes')) return false;
    if (el.closest(`.${SUMMARY_CLASS}`)) return false;
    if (el.querySelector('#curEditTextarea, .edit_textarea')) return false;

    const attrHidden = el.getAttribute('is_system') === 'true';
    const message = getMessageForElement(el);

    const messageHidden = message?.is_system === true;
    if (!attrHidden && !messageHidden) return false;

    const settings = getSettings();

    if (settings.excludeSmallSystem && message?.extra?.isSmallSys) return false;
    if (settings.excludeSillyTavernSystem && message?.name === systemUserName) return false;

    return true;
}

function collectVisibleMessageElements() {
    const root = getChatRoot();
    if (!root) return [];
    return Array.from(root.children).filter(el =>
        el instanceof HTMLElement && el.classList.contains('mes')
    );
}

function cleanup() {
    const root = getChatRoot();
    if (!root) return;

    root.querySelectorAll(`.${SUMMARY_CLASS}`).forEach(el => el.remove());

    root.querySelectorAll(`.${MESSAGE_MARKER_CLASS}, .${COLLAPSED_CLASS}`).forEach(el => {
        el.classList.remove(MESSAGE_MARKER_CLASS, COLLAPSED_CLASS);
        delete el.dataset.hffKey;
        delete el.dataset.hffIndex;
    });
}

function summarizeAuthors(ids) {
    const counts = new Map();

    for (const id of ids) {
        const message = chat[id];
        const name = message?.name || (message?.is_user ? 'User' : 'Assistant');
        counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    return Array.from(counts.entries())
        .slice(0, 4)
        .map(([name, count]) => `${name}×${count}`)
        .join(' / ');
}

function setGroupOpen(groupKey, isOpen) {
    const root = getChatRoot();
    if (!root) return;

    const summary = root.querySelector(`.${SUMMARY_CLASS}[data-hff-key="${CSS.escape(groupKey)}"]`);
    const messages = root.querySelectorAll(`.${MESSAGE_MARKER_CLASS}[data-hff-key="${CSS.escape(groupKey)}"]`);

    if (isOpen) {
        openGroups.add(groupKey);
    } else {
        openGroups.delete(groupKey);
    }

    messages.forEach(el => {
        el.classList.toggle(COLLAPSED_CLASS, !isOpen);
    });

    if (summary instanceof HTMLElement) {
        summary.classList.toggle(OPEN_CLASS, isOpen);
        summary.setAttribute('aria-expanded', String(isOpen));

        const caret = summary.querySelector('.hff-caret');
        if (caret) caret.textContent = isOpen ? '▾' : '▸';

        const hint = summary.querySelector('.hff-hint');
        if (hint) hint.textContent = isOpen ? '点击收起' : '点击展开';
    }
}

function toggleGroup(groupKey) {
    const currentlyOpen = openGroups.has(groupKey);
    setGroupOpen(groupKey, !currentlyOpen);
}

function makeSummaryElement(group, isOpen) {
    const [firstId, lastId] = [group.ids[0], group.ids[group.ids.length - 1]];
    const settings = getSettings();

    const summary = document.createElement('div');
    summary.className = `${SUMMARY_CLASS}${isOpen ? ` ${OPEN_CLASS}` : ''}`;
    summary.dataset.hffKey = group.key;
    summary.tabIndex = 0;
    summary.setAttribute('role', 'button');
    summary.setAttribute('aria-expanded', String(isOpen));
    summary.title = '点击展开/收起隐藏楼层';

    const icon = document.createElement('span');
    icon.className = 'hff-caret';
    icon.textContent = isOpen ? '▾' : '▸';

    const title = document.createElement('span');
    title.className = 'hff-title';
    title.textContent = `🙈 已隐藏 ${group.ids.length} 层：#${firstId}${firstId === lastId ? '' : `–#${lastId}`}`;

    const authors = summarizeAuthors(group.ids);
    const meta = document.createElement('span');
    meta.className = 'hff-meta';
    meta.textContent = authors ? ` ${authors}` : '';

    const previewText = normalizeText(chat[firstId]?.mes, settings.previewChars);
    const preview = document.createElement('span');
    preview.className = 'hff-preview';
    preview.textContent = previewText ? `「${previewText}」` : '';

    const hint = document.createElement('span');
    hint.className = 'hff-hint';
    hint.textContent = isOpen ? '点击收起' : '点击展开';

    summary.append(icon, title, meta, preview, hint);

    summary.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        toggleGroup(group.key);
    }, true);

    summary.addEventListener('pointerup', event => {
        event.preventDefault();
        event.stopPropagation();
    }, true);

    summary.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            toggleGroup(group.key);
        }
    }, true);

    return summary;
}

function buildGroups(messageElements) {
    const groups = [];
    let current = [];

    const flush = () => {
        if (!current.length) return;

        const ids = current.map(getMessageId).filter(id => id !== null);

        if (!ids.length) {
            current = [];
            return;
        }

        groups.push({
            elements: current,
            ids,
            key: `${ids[0]}-${ids[ids.length - 1]}`,
        });

        current = [];
    };

    for (const el of messageElements) {
        if (isFoldableHiddenMessage(el)) {
            current.push(el);
        } else {
            flush();
        }
    }

    flush();
    return groups;
}

function applyFold() {
    const root = getChatRoot();
    if (!root) return;

    applying = true;

    try {
        cleanup();

        const settings = getSettings();
        if (!settings.enabled) return;

        const messageElements = collectVisibleMessageElements();
        const groups = buildGroups(messageElements);

        for (const group of groups) {
            if (!group.elements.length) continue;

            const isOpen = settings.defaultOpen || openGroups.has(group.key);
            const summary = makeSummaryElement(group, isOpen);
            group.elements[0].before(summary);

            group.elements.forEach((el, index) => {
                el.classList.add(MESSAGE_MARKER_CLASS);
                el.dataset.hffKey = group.key;
                el.dataset.hffIndex = String(index);
                el.classList.toggle(COLLAPSED_CLASS, !isOpen);
            });
        }
    } finally {
        applying = false;
    }
}

function scheduleFold() {
    if (applying || scheduled) return;

    scheduled = true;

    requestAnimationFrame(() => {
        scheduled = false;
        applyFold();
    });
}

function observeChat() {
    const root = getChatRoot();
    if (!root || observer) return;

    observer = new MutationObserver(mutations => {
        if (applying) return;

        const relevant = mutations.some(mutation => {
            if (mutation.type === 'childList') return true;

            if (mutation.type === 'attributes') {
                const target = mutation.target;
                return target instanceof HTMLElement
                    && target.classList.contains('mes');
            }

            return false;
        });

        if (relevant) scheduleFold();
    });

    observer.observe(root, {
        childList: true,
        subtree: false,
        attributes: true,
        attributeFilter: ['is_system', 'mesid'],
    });
}

function showToast(message, type = 'info') {
    try {
        globalThis.toastr?.[type]?.(message, 'Hidden Floor Fold');
    } catch {
        console.log(`[Hidden Floor Fold] ${message}`);
    }
}

function registerCommands() {
    SlashCommandParser.addCommand(
        'hiddenfold',
        (_args, arg) => {
            const settings = getSettings();
            const action = String(arg ?? '').trim().toLowerCase() || 'toggle';

            if (['on', 'enable', 'enabled', 'true', '1'].includes(action)) {
                settings.enabled = true;
                saveSettings();
                scheduleFold();
                showToast('已开启 hidden 楼层自动合并折叠。', 'success');
                return 'on';
            }

            if (['off', 'disable', 'disabled', 'false', '0'].includes(action)) {
                settings.enabled = false;
                saveSettings();
                cleanup();
                showToast('已关闭 hidden 楼层自动合并折叠。', 'info');
                return 'off';
            }

            if (['open', 'defaultopen'].includes(action)) {
                settings.defaultOpen = true;
                saveSettings();
                scheduleFold();
                showToast('默认展开 hidden 折叠组。', 'info');
                return 'defaultOpen';
            }

            if (['closed', 'close', 'defaultclosed'].includes(action)) {
                settings.defaultOpen = false;
                saveSettings();
                scheduleFold();
                showToast('默认收起 hidden 折叠组。', 'info');
                return 'defaultClosed';
            }

            if (['refresh', 'reload'].includes(action)) {
                scheduleFold();
                return 'refreshed';
            }

            settings.enabled = !settings.enabled;
            saveSettings();

            if (settings.enabled) {
                scheduleFold();
                showToast('已开启 hidden 楼层自动合并折叠。', 'success');
                return 'on';
            } else {
                cleanup();
                showToast('已关闭 hidden 楼层自动合并折叠。', 'info');
                return 'off';
            }
        },
        [],
        'Fold consecutive hidden messages into grouped summary rows.',
    );

    SlashCommandParser.addCommand(
        'hiddenfold-refresh',
        () => {
            scheduleFold();
            return 'refreshed';
        },
        [],
        'Refresh Hidden Floor Fold groups.',
    );
}

function initEventHooks() {
    const events = [
        event_types.APP_READY,
        event_types.CHAT_CHANGED,
        event_types.CHAT_LOADED,
        event_types.MORE_MESSAGES_LOADED,
        event_types.MESSAGE_RECEIVED,
        event_types.MESSAGE_UPDATED,
        event_types.MESSAGE_DELETED,
    ];

    for (const eventType of events) {
        if (eventType) {
            eventSource.on(eventType, () => setTimeout(scheduleFold, 0));
        }
    }
}

function init() {
    getSettings();
    registerCommands();
    observeChat();
    initEventHooks();

    setTimeout(scheduleFold, 250);

    console.log('[Hidden Floor Fold] loaded');
}

init();

export function activate() {
    scheduleFold();
}

export function disable() {
    cleanup();
}

export function enable() {
    scheduleFold();
}
