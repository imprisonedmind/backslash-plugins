const { runPlayerctlCommand } = require("./utils");

const run = async (_, context) => {
  const { search } = context;

  const didRun = await runPlayerctlCommand(context, {
    command: "playerctl previous",
    errorPrefix: "Failed to go to the previous item",
  });

  if (didRun) {
    search?.clear?.();
  }
};

module.exports = { run, actions: [] };
