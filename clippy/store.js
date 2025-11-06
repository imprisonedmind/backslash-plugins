const fs = require('fs/promises');
const crypto = require('crypto');
const { BrowserWindow } = require('electron');

const MAX_HISTORY_ITEMS = 200;
const MAX_RESULTS = 50;
const MAX_STORED_LENGTH = 20000;
const POLL_INTERVAL_MS = 1200;

let storagePath;
let history = [];
let pollTimer = null;
let lastSignature = null;
let initPromise = null;
let depsRef = null;
let showWindowTimer = null;

const generateId = () =>
  crypto.randomUUID ? crypto.randomUUID() : `clip-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normaliseNewlines = (value) => value.replace(/\r\n/g, '\n');

const buildEntry = (value, overrides = {}) => {
  if (typeof value !== 'string') return null;

  const limited = value.length > MAX_STORED_LENGTH ? value.slice(0, MAX_STORED_LENGTH) : value;
  const normalized = normaliseNewlines(limited);
  const signature = normalized.trim();

  if (!signature) return null;

  const createdAt =
    typeof overrides.createdAt === 'number' && !Number.isNaN(overrides.createdAt)
      ? overrides.createdAt
      : Date.now();

  return {
    id: overrides.id || generateId(),
    text: limited,
    normalized,
    lower: normalized.toLowerCase(),
    signature,
    createdAt,
    isFavorite: Boolean(overrides.isFavorite)
  };
};

const sortHistory = () => {
  history.sort((a, b) => {
    if (a.createdAt === b.createdAt) return 0;
    return b.createdAt - a.createdAt;
  });
};

const loadStoredHistory = async () => {
  if (!storagePath) return [];

  try {
    const file = await fs.readFile(storagePath, 'utf8');
    const data = JSON.parse(file);

    if (!Array.isArray(data)) return [];

    return data
      .map((item) => buildEntry(item.text, { id: item.id, createdAt: item.createdAt, isFavorite: item.isFavorite }))
      .filter(Boolean)
      .slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
};

const persistHistory = async () => {
  if (!storagePath) return;

  sortHistory();

  const payload = history.slice(0, MAX_HISTORY_ITEMS).map(({ id, text, createdAt, isFavorite }) => ({
    id,
    text,
    createdAt,
    isFavorite
  }));

  try {
    await fs.writeFile(storagePath, JSON.stringify(payload), 'utf8');
  } catch (error) {
    console.warn('[clippy] Failed to persist clipboard history:', error.message);
    throw error;
  }
};

const syncLastSignature = () => {
  lastSignature = history.length > 0 ? history[0].signature : null;
};

const requestShowMainWindow = () => {
  if (showWindowTimer) {
    clearTimeout(showWindowTimer);
  }

  showWindowTimer = setTimeout(() => {
    try {
      const windows = BrowserWindow?.getAllWindows?.() ?? [];
      const mainWindow = windows.find((win) => !win.isDestroyed());

      if (mainWindow) {
        // TODO: Replace this hack once Backslash supports keeping the window open after subcommand actions.
        mainWindow.show();
        mainWindow.focus();
      }
    } catch (error) {
      console.warn('[clippy] Failed to show main window:', error.message);
    }
  }, 80);
};

const captureClipboard = async () => {
  if (!depsRef) return;

  let clipboardValue;

  try {
    clipboardValue = depsRef.clipboard.readText();
  } catch (error) {
    console.warn('[clippy] Failed to read clipboard contents:', error.message);
    if (depsRef.toast?.error) {
      depsRef.toast.error('Clipboard read failed', {
        description: error.message
      });
    }
    return;
  }

  const entry = buildEntry(clipboardValue);
  if (!entry) return;

  if (entry.signature === lastSignature) return;

  const duplicateIndex = history.findIndex((item) => item.signature === entry.signature);

  if (duplicateIndex !== -1) {
    const duplicate = history.splice(duplicateIndex, 1)[0];
    entry.id = duplicate.id;
    entry.createdAt = Date.now();
    entry.isFavorite = duplicate.isFavorite;
  }

  history.unshift(entry);
  if (history.length > MAX_HISTORY_ITEMS) history = history.slice(0, MAX_HISTORY_ITEMS);
  sortHistory();

  syncLastSignature();

  try {
    await persistHistory();
  } catch (error) {
    if (depsRef.toast?.error) {
      depsRef.toast.error('Failed to persist history', { description: error.message });
    }
  }
};

const startPolling = () => {
  if (pollTimer || !depsRef) return;

  pollTimer = setInterval(() => {
    captureClipboard().catch((error) =>
      console.warn('[clippy] Unexpected error while tracking clipboard:', error.message)
    );
  }, POLL_INTERVAL_MS);

  if (typeof pollTimer.unref === 'function') pollTimer.unref();

  captureClipboard().catch((error) =>
    console.warn('[clippy] Unexpected error while tracking clipboard:', error.message)
  );
};

const ensureInitialized = async (deps) => {
  depsRef = deps;

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    storagePath = deps.path.join(deps.app.getPath('userData'), 'clippy-history.json');
    history = await loadStoredHistory();
    sortHistory();
    syncLastSignature();
    startPolling();
  })();

  return initPromise;
};

const filterEntries = (query) => {
  if (!query) return history;

  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) return history;

  return history.filter((entry) => terms.every((term) => entry.lower.includes(term)));
};

const getEntries = (query) => filterEntries(query);

const getFavoriteEntries = (query) => getEntries(query).filter((entry) => entry.isFavorite);

const truncate = (value, length) => {
  if (!value) return '';
  if (value.length <= length) return value;
  return value.slice(0, Math.max(0, length - 3)) + '...';
};

const formatNumber = (value) => {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}`.replace(/\.0$/, '');
};

const formatLength = (length) => {
  if (length === 1) return '1 char';
  if (length < 1000) return `${length} chars`;
  if (length < 1000000) return `${formatNumber(length / 1000)}k chars`;
  return `${formatNumber(length / 1000000)}M chars`;
};

const formatRelativeTime = (timestamp) => {
  const diffMs = Date.now() - timestamp;

  if (diffMs < 45000) return 'just now';

  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.round(months / 12);
  return `${years}y ago`;
};

const buildResult = (entry) => {
  const title = entry.normalized.trim() || '(empty)';

  const detailLines = [
    {
      type: 'span',
      content: title,
      className:
        'text-left text-sm text-zinc-100 whitespace-pre-line break-words overflow-hidden',
      props: {
        style: {
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical'
        }
      }
    },
    {
      type: 'p',
      content: formatLength(entry.text.length),
      className: 'text-left text-xs text-zinc-500'
    }
  ];

  const trailingChildren = [];

  if (entry.isFavorite) {
    trailingChildren.push({
      type: 'icon',
      className: 'ph-fill ph-heart text-pink-400 text-lg'
    });
  }

  trailingChildren.push({
    type: 'badge',
    content: formatRelativeTime(entry.createdAt),
    className: ''
  });

  const trailingElements = trailingChildren.length
    ? [
        {
          type: 'div',
          className: 'flex items-center gap-2 shrink-0 self-center',
          content: '',
          children: trailingChildren
        }
      ]
    : [];

  return {
    data: {
      id: entry.id,
      text: entry.text,
      createdAt: entry.createdAt,
      isFavorite: entry.isFavorite
    },
    content: [
      {
        type: 'div',
        className: 'flex items-center gap-3 w-full',
        content: '',
        children: [
          {
            type: 'div',
            className: 'flex flex-col gap-1 flex-1 overflow-hidden',
            content: '',
            children: detailLines
          },
          ...trailingElements
        ]
      }
    ]
  };
};

const summarizeForError = (value) => {
  const singleLine = normaliseNewlines(value).replace(/\s+/g, ' ').trim();
  return truncate(singleLine, 60);
};

const promoteEntry = (data) => {
  const index = history.findIndex((item) => item.id === data.id);
  const now = Date.now();

  if (index !== -1) {
    const [item] = history.splice(index, 1);
    item.createdAt = now;
    history.unshift(item);
    sortHistory();
    return true;
  }

  const entry = buildEntry(data.text, { createdAt: now, isFavorite: data.isFavorite });
  if (!entry) return false;

  history.unshift(entry);
  if (history.length > MAX_HISTORY_ITEMS) history = history.slice(0, MAX_HISTORY_ITEMS);
  sortHistory();
  return true;
};

const copyEntry = async (data, deps) => {
  const depsObj = deps || depsRef;
  if (!depsObj) return;

  try {
    depsObj.clipboard.writeText(data.text);
  } catch (error) {
    console.warn('[clippy] Failed to write clipboard contents:', error.message);
    if (depsObj.toast?.error) {
      const preview = data?.text ? summarizeForError(data.text) : '';
      depsObj.toast.error('Copy failed', {
        description: preview ? `${preview}\n${error.message}` : error.message
      });
    }
    return;
  }

  const wasPromoted = promoteEntry(data);
  syncLastSignature();

  try {
    await persistHistory();
  } catch (error) {
    console.warn('[clippy] Failed to persist history after copy:', error.message);
    if (depsObj.toast?.error) {
      depsObj.toast.error('Failed to persist history', { description: error.message });
    }
  }

  if (!wasPromoted) {
    lastSignature = history.length > 0 ? history[0].signature : null;
  }
};

const removeEntry = async (data, deps) => {
  const index = history.findIndex((item) => item.id === data.id);
  if (index === -1) {
    return;
  }

  history.splice(index, 1);
  syncLastSignature();

  try {
    await persistHistory();
  } catch (error) {
    console.warn('[clippy] Failed to persist history after removal:', error.message);
    if ((deps || depsRef)?.toast?.error) {
      (deps || depsRef).toast.error('Failed to persist history', { description: error.message });
    }
  }
};

const clearHistory = async (_data, deps) => {
  history = [];
  syncLastSignature();

  try {
    await persistHistory();
  } catch (error) {
    console.warn('[clippy] Failed to clear history:', error.message);
    if ((deps || depsRef)?.toast?.error) {
      (deps || depsRef).toast.error('Failed to clear history', { description: error.message });
    }
  }
};

const setFavorite = async (data, shouldFavorite, deps) => {
  const entry = history.find((item) => item.id === data.id);
  if (!entry) return;

  entry.isFavorite = shouldFavorite;

  try {
    await persistHistory();
  } catch (error) {
    console.warn('[clippy] Failed to persist history after favourite toggle:', error.message);
    if ((deps || depsRef)?.toast?.error) {
      (deps || depsRef).toast.error('Failed to update favourites', { description: error.message });
    }
  }

  requestShowMainWindow();
};

const favouriteEntry = (data, deps) => setFavorite(data, true, deps);
const unfavouriteEntry = (data, deps) => setFavorite(data, false, deps);

module.exports = {
  MAX_RESULTS,
  ensureInitialized,
  getEntries,
  getFavoriteEntries,
  buildResult,
  copyEntry,
  removeEntry,
  clearHistory,
  favouriteEntry,
  unfavouriteEntry
};
