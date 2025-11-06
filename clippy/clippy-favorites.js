const store = require('./store');

const run = async (query, deps) => {
  await store.ensureInitialized(deps);

  const safeQuery = typeof query === 'string' ? query : '';
  const entries = store.getFavoriteEntries(safeQuery);

  return entries.slice(0, store.MAX_RESULTS).map(store.buildResult);
};

module.exports = {
  run,
  actions: [
    { name: 'Copy to clipboard', action: store.copyEntry },
    { name: 'Remove from favourites', action: store.unfavouriteEntry }
  ]
};
