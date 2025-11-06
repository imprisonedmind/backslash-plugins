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

const ensurePlayerctl = async ({ exec, toast }) => {
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

const handleNoPlayersFound = (toast) => {
  if (toast?.error) {
    toast.error("No media players running", {
      description: "Start playback in your media player and try again.",
    });
  }
};

const runPlayerctlCommand = async (
  context,
  { command, errorPrefix }
) => {
  const { exec, toast } = context;

  await ensurePlayerctl(context);

  try {
    await execCommand(exec, command);
    return true;
  } catch (error) {
    const message = error?.message || "Unknown error";

    if (message.toLowerCase().includes("no players found")) {
      handleNoPlayersFound(toast);
      return false;
    }

    throw new Error(`${errorPrefix}: ${message}`);
  }
};

module.exports = {
  execCommand,
  ensurePlayerctl,
  runPlayerctlCommand,
};
