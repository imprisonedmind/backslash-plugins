const store = require('./store');

const run = async (query, deps) => {
  await store.ensureInitialized(deps);

  const safeQuery = typeof query === 'string' ? query : '';
  const entries = store.getEntries(safeQuery);

  // TODO: Needs Backslash to expose refresh/run-again hooks so history can update live.
  return entries.slice(0, store.MAX_RESULTS).map(store.buildResult);
};

module.exports = {
  run,
  actions: [
    { name: 'Copy to clipboard', action: store.copyEntry },
    { name: 'Add to favourites', action: store.favouriteEntry },
    { name: 'Remove from favourites', action: store.unfavouriteEntry },
    { name: 'Remove from history', action: store.removeEntry },
    { name: 'Clear history', action: store.clearHistory }
  ]
};
