const { runPlayerctlCommand } = require("./utils");

const run = async (_, context) => {
  const { search } = context;

  const didRun = await runPlayerctlCommand(context, {
    command: "playerctl play",
    errorPrefix: "Failed to start media playback",
  });

  if (didRun) {
    search?.clear?.();
  }
};

module.exports = { run, actions: [] };
