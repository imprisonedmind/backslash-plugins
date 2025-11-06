const {
  ensureXprop,
  ensureXdotool,
  getTargetWindowId,
  minimizeWindow,
} = require("./utils");

const run = async (_, { exec, toast, search }) => {
  await ensureXprop(exec, toast);
  await ensureXdotool(exec, toast);

  try {
    const { targetWindowId } = await getTargetWindowId(exec);

    if (!targetWindowId) {
      throw new Error("No window available to minimize.");
    }

    await minimizeWindow(exec, targetWindowId);
    search?.clear?.();
  } catch (error) {
    const message = `Failed to minimize window: ${error.message}`;
    if (toast?.error) {
      toast.error("Command failed", { description: message });
    }

    throw new Error(message);
  }
};

module.exports = { run, actions: [] };
