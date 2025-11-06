const { runPlayerctlCommand } = require("./utils");

const run = async (_, context) => {
  const { search } = context;

  const didRun = await runPlayerctlCommand(context, {
    command: "playerctl pause",
    errorPrefix: "Failed to pause media playback",
  });

  if (didRun) {
    search?.clear?.();
  }
};

module.exports = { run, actions: [] };
