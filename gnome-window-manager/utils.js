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

const ensureDependency = async (exec, toast, { binary, installHint }) => {
  try {
    await execCommand(exec, `command -v ${binary}`);
  } catch {
    const description =
      installHint ||
      `Install "${binary}" with your package manager and try again.`;

    if (toast?.error) {
      toast.error("Missing dependency", { description });
    }

    throw new Error(
      `${binary} is required for this command. ${description}`
    );
  }
};

const ensureWmctrl = (exec, toast) =>
  ensureDependency(exec, toast, {
    binary: "wmctrl",
    installHint: "Install it with: sudo apt install wmctrl",
  });

const ensureXprop = (exec, toast) =>
  ensureDependency(exec, toast, {
    binary: "xprop",
    installHint: "Install it with: sudo apt install x11-utils",
  });

module.exports = {
  execCommand,
  ensureDependency,
  ensureWmctrl,
  ensureXprop,
};
