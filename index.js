import {
    chat,
    chatElement,
    eventSource,
    event_types,
} from '/script.js';

import {
    extension_settings,
    saveSettingsDebounced,
} from '/scripts/extensions.js';

import { SlashCommandParser } from '/scripts/slash-commands/SlashCommandParser.js';

const MODULE_NAME = 'hiddenFloorFold';

const GROUP_CLASS = 'hff-group';
const SUMMARY_CLASS = 'hff-summary';
const MESSAGE_CLASS = 'hff-hidden-message';
const COLLAPSED_CLASS = 'hff-collapsed';

const DEFAULT_SETTINGS = {
    enabled: true,
    defaultOpen: false,
    previewChars: 86,
    excludeSmallSystem: true,
};

let observer = null;
let scheduled = false;
let rebuilding = false;

/** Remember manually opened groups by stable "firstId-lastId" key. */
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

function getMessageId(element) {
    const id = Number(element?.getAttribute?.('mesid'));
    return Number.isInteger(id) ? id : null;
}

function getMessageForElement(element) {
    const id = getMessageId(element);
    return id === null ? null : chat[id];
}

function normalizeText(text, maxLength) {
    const normalized = String(text ?? '')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (!normalized) return '';

    return normalized.length > maxLength
        ? `${normalized.slice(0, maxLength)}…`
        : normalized;
}

function isFoldableHiddenMessage(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (!element.classList.contains('mes')) return false;
    if (element.querySelector('#curEditTextarea, .edit_textarea')) return false;

    const message = getMessageForElement(element);

    // SillyTavern's hide operation marks chat[messageId].is_system = true
    // and mirrors that state onto .mes[is_system="true"].
    const hiddenByDom = element.getAttribute('is_system') === 'true';
    const hiddenByData = message?.is_system === true;
    if (!hiddenByDom && !hiddenByData) return false;

    const settings = getSettings();

    // Avoid folding ST's tiny internal notices.
    if (settings.excludeSmallSystem && message?.extra?.isSmallSys) return false;

    return true;
}

function getTopLevelMessages() {
    const root = getChatRoot();
    if (!root) return [];

    return Array.from(root.children)
        .filter(element => element instanceof HTMLElement && element.classList.contains('mes'));
}

function cleanupGroups() {
    const root = getChatRoot();
    if (!root) return;

    root.querySelectorAll(`.${GROUP_CLASS}`).forEach(element => element.remove());

    root.querySelectorAll(`.${MESSAGE_CLASS}, .${COLLAPSED_CLASS}`).forEach(element => {
        element.classList.remove(MESSAGE_CLASS, COLLAPSED_CLASS);
        delete element.dataset.hffKey;
        delete element.dataset.hffIndex;
    });
}

function buildGroups(messageElements) {
    const groups = [];
    let current = [];

    const flush = () => {
        if (!current.length) return;

        const ids = current
            .map(getMessageId)
            .filter(id => id !== null);

        if (ids.length) {
            groups.push({
                key: `${ids[0]}-${ids[ids.length - 1]}`,
                ids,
                elements: current,
            });
        }

        current = [];
    };

    for (const element of messageElements) {
        if (isFoldableHiddenMessage(element)) {
            current.push(element);
        } else {
            flush();
        }
    }

    flush();
    return groups;
}

function summarizeAuthors(ids) {
    const counts = new Map();

    for (const id of ids) {
        const message = chat[id];
        const name = message?.name || (message?.is_user ? 'User' : 'Assistant');
        counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    return Array.from(counts.entries())
        .slice(0, 5)
        .map(([name, count]) => `${name} × ${count}`)
        .join(' · ');
}

function setGroupCollapsed(key, shouldCollapse) {
    const root = getChatRoot();
    if (!root) return;

    const escapedKey = CSS.escape(key);
    const messages = root.querySelectorAll(`.${MESSAGE_CLASS}[data-hff-key="${escapedKey}"]`);

    messages.forEach(element => {
        element.classList.toggle(COLLAPSED_CLASS, shouldCollapse);
    });
}

function updateDetailsLabel(details) {
    const action = details.querySelector('.hff-action');
    if (action) {
        action.textContent = details.open ? '收起' : '展开';
    }

    const marker = details.querySelector('.hff-marker');
    if (marker) {
        marker.textContent = details.open ? 'OPEN' : 'HIDDEN';
    }

    details.setAttribute('aria-expanded', String(details.open));
}

function makeDetails(group, isOpen) {
    const [firstId, lastId] = [group.ids[0], group.ids[group.ids.length - 1]];
    const settings = getSettings();

    const details = document.createElement('details');
    details.className = GROUP_CLASS;
    details.dataset.hffKey = group.key;
    details.dataset.hffIds = group.ids.join(',');
    details.open = isOpen;
    details.setAttribute('aria-expanded', String(isOpen));

    const summary = document.createElement('summary');
    summary.className = SUMMARY_CLASS;
    summary.title = isOpen ? '点击收起隐藏楼层' : '点击展开隐藏楼层';

    const marker = document.createElement('span');
    marker.className = 'hff-marker';
    marker.textContent = isOpen ? 'OPEN' : 'HIDDEN';

    const title = document.createElement('span');
    title.className = 'hff-title';
    title.textContent = `${group.ids.length} hidden floor${group.ids.length > 1 ? 's' : ''}`;

    const range = document.createElement('span');
    range.className = 'hff-range';
    range.textContent = `#${firstId}${firstId === lastId ? '' : ` — #${lastId}`}`;

    const authors = document.createElement('span');
    authors.className = 'hff-authors';
    authors.textContent = summarizeAuthors(group.ids);

    const preview = document.createElement('span');
    preview.className = 'hff-preview';
    const previewText = normalizeText(chat[firstId]?.mes, settings.previewChars);
    preview.textContent = previewText ? previewText : 'Hidden messages folded here.';

    const action = document.createElement('span');
    action.className = 'hff-action';
    action.textContent = isOpen ? '收起' : '展开';

    summary.append(marker, title, range, authors, preview, action);
    details.append(summary);

    // Native <details> handles the click. We only mirror that open state to the real .mes siblings.
    details.addEventListener('toggle', () => {
        if (details.open) {
            openGroups.add(group.key);
        } else {
            openGroups.delete(group.key);
        }

        setGroupCollapsed(group.key, !details.open);
        updateDetailsLabel(details);
    });

    return details;
}

function rebuild() {
    const root = getChatRoot();
    if (!root) return;

    rebuilding = true;

    try {
        cleanupGroups();

        const settings = getSettings();
        if (!settings.enabled) return;

        const groups = buildGroups(getTopLevelMessages());

        for (const group of groups) {
            const isOpen = settings.defaultOpen || openGroups.has(group.key);
            const details = makeDetails(group, isOpen);

            group.elements[0].before(details);

            group.elements.forEach((element, index) => {
                element.classList.add(MESSAGE_CLASS);
                element.classList.toggle(COLLAPSED_CLASS, !isOpen);
                element.dataset.hffKey = group.key;
                element.dataset.hffIndex = String(index);
            });
        }
    } finally {
        rebuilding = false;
    }
}

function scheduleRebuild() {
    if (rebuilding || scheduled) return;

    scheduled = true;
    requestAnimationFrame(() => {
        scheduled = false;
        rebuild();
    });
}

function observeChat() {
    const root = getChatRoot();
    if (!root || observer) return;

    observer = new MutationObserver((mutations) => {
        if (rebuilding) return;

        const relevant = mutations.some(mutation => {
            if (mutation.type === 'childList') return true;
            if (mutation.type === 'attributes') {
                const target = mutation.target;
                return target instanceof HTMLElement && target.classList.contains('mes');
            }
            return false;
        });

        if (relevant) scheduleRebuild();
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
        globalThis.toastr?.[type]?.(message, 'Fold Hidden Floor');
    } catch {
        console.log(`[Fold Hidden Floor] ${message}`);
    }
}

function registerCommands() {
    SlashCommandParser.addCommand(
        'hiddenfold',
        (_args, input) => {
            const settings = getSettings();
            const action = String(input ?? '').trim().toLowerCase() || 'toggle';

            if (['on', 'enable', 'enabled', 'true', '1'].includes(action)) {
                settings.enabled = true;
                saveSettings();
                scheduleRebuild();
                showToast('已开启 hidden 楼层自动折叠。', 'success');
                return 'on';
            }

            if (['off', 'disable', 'disabled', 'false', '0'].includes(action)) {
                settings.enabled = false;
                saveSettings();
                cleanupGroups();
                showToast('已关闭 hidden 楼层自动折叠。', 'info');
                return 'off';
            }

            if (['open', 'defaultopen'].includes(action)) {
                settings.defaultOpen = true;
                saveSettings();
                scheduleRebuild();
                showToast('默认展开 hidden 折叠组。', 'info');
                return 'defaultOpen';
            }

            if (['closed', 'close', 'defaultclosed'].includes(action)) {
                settings.defaultOpen = false;
                saveSettings();
                scheduleRebuild();
                showToast('默认收起 hidden 折叠组。', 'info');
                return 'defaultClosed';
            }

            if (['refresh', 'reload'].includes(action)) {
                scheduleRebuild();
                return 'refreshed';
            }

            settings.enabled = !settings.enabled;
            saveSettings();

            if (settings.enabled) {
                scheduleRebuild();
                showToast('已开启 hidden 楼层自动折叠。', 'success');
                return 'on';
            }

            cleanupGroups();
            showToast('已关闭 hidden 楼层自动折叠。', 'info');
            return 'off';
        },
        [],
        `
        <div>Fold consecutive hidden messages into magazine-style details rows.</div>
        <div>
            <strong>Examples:</strong>
            <ul>
                <li><pre><code>/hiddenfold on</code></pre></li>
                <li><pre><code>/hiddenfold off</code></pre></li>
                <li><pre><code>/hiddenfold toggle</code></pre></li>
                <li><pre><code>/hiddenfold closed</code></pre></li>
                <li><pre><code>/hiddenfold open</code></pre></li>
            </ul>
        </div>
        `,
    );

    SlashCommandParser.addCommand(
        'hiddenfold-refresh',
        () => {
            scheduleRebuild();
            return 'refreshed';
        },
        [],
        'Refresh hidden message folds.',
    );
}

function hookEvents() {
    const events = [
        event_types.APP_READY,
        event_types.CHAT_CHANGED,
        event_types.CHAT_LOADED,
        event_types.MORE_MESSAGES_LOADED,
        event_types.MESSAGE_RECEIVED,
        event_types.MESSAGE_UPDATED,
        event_types.MESSAGE_DELETED,
    ].filter(Boolean);

    for (const eventType of events) {
        eventSource.on(eventType, () => setTimeout(scheduleRebuild, 0));
    }
}

function init() {
    getSettings();
    registerCommands();
    observeChat();
    hookEvents();

    setTimeout(scheduleRebuild, 250);
    console.log('[Fold Hidden Floor] loaded');
}

init();

export function enable() {
    getSettings().enabled = true;
    scheduleRebuild();
}

export function disable() {
    getSettings().enabled = false;
    cleanupGroups();
}
