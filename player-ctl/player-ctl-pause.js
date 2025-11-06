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

const ensurePlayerctl = async (exec) => {
  try {
    await execCommand(exec, "command -v playerctl");
  } catch {
    throw new Error("playerctl is required to control media. Install it with your package manager.");
  }
};

const run = async (_, { exec }) => {
  await ensurePlayerctl(exec);

  try {
    await execCommand(exec, "playerctl pause");
  } catch (error) {
    throw new Error(`Failed to pause media playback: ${error.message}`);
  }
};

module.exports = { run, actions: [] };
