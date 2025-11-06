const execCommand = (exec, command) =>
  new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        const message = stderr?.trim() || error.message || "Unknown error";
        return reject(new Error(message));
      }
      resolve(stdout);
    });
  });

const ensurePlayerctl = async (exec, toast) => {
  try {
    await execCommand(exec, "command -v playerctl");
  } catch {
    const message =
      "playerctl is required to control media. Install it with your package manager.";

    if (toast?.error) {
      toast.error("Missing dependency", { description: message });
    }

    throw new Error(message);
  }
};

const run = async (_, { exec, toast }) => {
  await ensurePlayerctl(exec, toast);

  try {
    await execCommand(exec, "playerctl play");
  } catch (error) {
    throw new Error(`Failed to start media playback: ${error.message}`);
  }
};

module.exports = { run, actions: [] };
