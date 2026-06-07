// Hidden Floor Collapse for SillyTavern
// Groups consecutive hidden (is_system="true") chat messages into a details-like fold.

import { eventSource, event_types } from '/script.js';
import { SlashCommand } from '/scripts/slash-commands/SlashCommand.js';
import { SlashCommandParser } from '/scripts/slash-commands/SlashCommandParser.js';

const MODULE_NAME = 'hidden-floor-collapse';
const CHAT_SELECTOR = '#chat';
const DETAILS_CLASS = 'st-hfc-details';
const GROUPED_CLASS = 'st-hfc-grouped-message';
const COLLAPSED_CLASS = 'st-hfc-collapsed-message';
const HIDDEN_SELECTOR = '.mes[is_system="true"]';

let observer = null;
let scheduled = false;
let suppressMutationObserver = false;
let initialized = false;

function getChatElement() {
    return document.querySelector(CHAT_SELECTOR);
}

function isOurDetails(node) {
    return node instanceof HTMLElement && node.classList.contains(DETAILS_CLASS);
}

function isCollapsibleHiddenMessage(node) {
    if (!(node instanceof HTMLElement)) return false;
    if (!node.classList.contains('mes')) return false;
    if (node.getAttribute('is_system') !== 'true') return false;

    // Leave SillyTavern's own small system/tool blocks alone.
    if (node.classList.contains('smallSysMes')) return false;
    if (node.classList.contains('toolCall')) return false;
    if (node.getAttribute('type') === 'system') return false;

    return true;
}

function getMessageId(messageElement) {
    const raw = messageElement.getAttribute('mesid');
    const number = Number(raw);
    return Number.isFinite(number) ? number : null;
}

function getMessageName(messageElement) {
    const nameFromAttr = messageElement.getAttribute('ch_name');
    const nameFromDom = messageElement.querySelector('.ch_name .name_text')?.textContent?.trim();
    return nameFromDom || nameFromAttr || 'Unknown';
}

function getMessagePreview(messageElement) {
    const text = messageElement.querySelector('.mes_text')?.textContent || '';
    return text.replace(/\s+/g, ' ').trim();
}

function summarizeNames(group) {
    const counts = new Map();
    for (const message of group) {
        const name = getMessageName(message);
        counts.set(name, (counts.get(name) || 0) + 1);
    }
    return Array.from(counts.entries())
        .slice(0, 4)
        .map(([name, count]) => `${name} ×${count}`)
        .join(' / ');
}

function summarizeRange(group) {
    const firstId = getMessageId(group[0]);
    const lastId = getMessageId(group[group.length - 1]);
    if (firstId === null || lastId === null) return '';
    return firstId === lastId ? `#${firstId}` : `#${firstId}–#${lastId}`;
}

function createDetailsForGroup(group) {
    const details = document.createElement('details');
    details.className = DETAILS_CLASS;
    details.dataset.count = String(group.length);
    details.dataset.range = summarizeRange(group);

    const summary = document.createElement('summary');
    summary.className = 'st-hfc-summary';

    const title = document.createElement('span');
    title.className = 'st-hfc-title';
    title.textContent = `已隐藏${group.length}层`;

    const range = document.createElement('span');
    range.className = 'st-hfc-range';
    range.textContent = summarizeRange(group);

    const names = document.createElement('span');
    names.className = 'st-hfc-names';
    names.textContent = summarizeNames(group);

    const preview = document.createElement('span');
    preview.className = 'st-hfc-preview';
    const firstPreview = getMessagePreview(group[0]);
    preview.textContent = firstPreview ? `“${firstPreview.slice(0, 88)}${firstPreview.length > 88 ? '…' : ''}”` : '点击展开查看隐藏楼层';

    const hint = document.createElement('span');
    hint.className = 'st-hfc-hint';
    hint.textContent = '展开';

    summary.append(title, range, names, preview, hint);
    details.append(summary);

    details.addEventListener('toggle', () => syncGroupVisibility(details, group));

    return details;
}

function syncGroupVisibility(details, group) {
    const collapsed = !details.open;
    details.classList.toggle('is-open', details.open);
    const hint = details.querySelector('.st-hfc-hint');
    if (hint) hint.textContent = details.open ? '折叠' : '展开';

    for (const message of group) {
        message.classList.add(GROUPED_CLASS);
        message.classList.toggle(COLLAPSED_CLASS, collapsed);
    }
}

function cleanupExistingFolds(chat) {
    chat.querySelectorAll(`:scope > .${DETAILS_CLASS}`).forEach(node => node.remove());
    chat.querySelectorAll(`:scope > .mes.${GROUPED_CLASS}, :scope > .mes.${COLLAPSED_CLASS}`).forEach(node => {
        node.classList.remove(GROUPED_CLASS, COLLAPSED_CLASS);
    });
}

function findHiddenGroups(chat) {
    const groups = [];
    let current = [];

    for (const child of Array.from(chat.children)) {
        if (isOurDetails(child)) continue;

        if (isCollapsibleHiddenMessage(child)) {
            current.push(child);
            continue;
        }

        if (current.length) {
            groups.push(current);
            current = [];
        }
    }

    if (current.length) groups.push(current);
    return groups;
}

function applyHiddenFloorCollapse() {
    const chat = getChatElement();
    if (!chat) return;

    suppressMutationObserver = true;
    try {
        cleanupExistingFolds(chat);
        const groups = findHiddenGroups(chat);

        for (const group of groups) {
            const details = createDetailsForGroup(group);
            group[0].before(details);
            syncGroupVisibility(details, group);
        }
    } finally {
        requestAnimationFrame(() => {
            suppressMutationObserver = false;
        });
    }
}

function scheduleApply(reason = 'unknown') {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
        scheduled = false;
        try {
            applyHiddenFloorCollapse();
        } catch (error) {
            console.error(`[${MODULE_NAME}] Failed to apply folds after ${reason}:`, error);
        }
    });
}

function setupMutationObserver() {
    const chat = getChatElement();
    if (!chat || observer) return;

    observer = new MutationObserver((mutations) => {
        if (suppressMutationObserver) return;

        const relevant = mutations.some((mutation) => {
            if (mutation.type === 'childList') return true;
            if (mutation.type === 'attributes' && mutation.attributeName === 'is_system') return true;
            return false;
        });

        if (relevant) scheduleApply('mutation');
    });

    observer.observe(chat, {
        childList: true,
        subtree: false,
        attributes: true,
        attributeFilter: ['is_system'],
    });
}

function openAllFolds() {
    document.querySelectorAll(`${CHAT_SELECTOR} > .${DETAILS_CLASS}`).forEach((details) => {
        if (details instanceof HTMLDetailsElement) details.open = true;
    });
}

function closeAllFolds() {
    document.querySelectorAll(`${CHAT_SELECTOR} > .${DETAILS_CLASS}`).forEach((details) => {
        if (details instanceof HTMLDetailsElement) details.open = false;
    });
}

function registerSlashCommands() {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'hfc-refresh',
        aliases: ['hidden-fold-refresh'],
        callback: () => {
            scheduleApply('slash-refresh');
            return 'true';
        },
        helpString: 'Rebuild hidden-message fold groups.',
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'hfc-open',
        aliases: ['hidden-fold-open'],
        callback: () => {
            openAllFolds();
            return 'true';
        },
        helpString: 'Open all hidden-message fold groups.',
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'hfc-close',
        aliases: ['hidden-fold-close'],
        callback: () => {
            closeAllFolds();
            return 'true';
        },
        helpString: 'Close all hidden-message fold groups.',
    }));
}

export function init() {
    if (initialized) return;
    initialized = true;

    setupMutationObserver();
    registerSlashCommands();

    const refreshEvents = [
        event_types.APP_READY,
        event_types.CHAT_CHANGED,
        event_types.CHAT_LOADED,
        event_types.MORE_MESSAGES_LOADED,
        event_types.MESSAGE_RECEIVED,
        event_types.MESSAGE_SENT,
        event_types.MESSAGE_UPDATED,
        event_types.MESSAGE_EDITED,
        event_types.MESSAGE_DELETED,
        event_types.MESSAGE_SWIPED,
        event_types.MESSAGE_SWIPE_DELETED,
        event_types.CHARACTER_MESSAGE_RENDERED,
        event_types.USER_MESSAGE_RENDERED,
    ].filter(Boolean);

    for (const eventName of refreshEvents) {
        eventSource.on(eventName, () => scheduleApply(eventName));
    }

    scheduleApply('init');
    console.info('[Hidden Floor Collapse] loaded');
}
