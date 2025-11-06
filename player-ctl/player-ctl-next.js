const { runPlayerctlCommand } = require("./utils");

const run = async (_, context) => {
  const { search } = context;

  const didRun = await runPlayerctlCommand(context, {
    command: "playerctl next",
    errorPrefix: "Failed to skip to the next item",
  });

  if (didRun) {
    search?.clear?.();
  }
};

module.exports = { run, actions: [] };
