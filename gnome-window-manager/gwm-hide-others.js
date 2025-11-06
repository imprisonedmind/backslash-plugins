const { ensureXprop, ensureXdotool, getTargetWindowId, getStackingOrder, minimizeWindow } = require("./utils");

const run = async (_, { exec, toast, search }) => {
  await ensureXprop(exec, toast);
  await ensureXdotool(exec, toast);

  try {
    const { targetWindowId } = await getTargetWindowId(exec);
    const stackingOrder = await getStackingOrder(exec);

    const minimizeTargets = stackingOrder.filter(
      (windowId) =>
        windowId &&
        windowId !== "0x0" &&
        windowId.toLowerCase() !== targetWindowId?.toLowerCase()
    );

    const errors = [];

    for (const windowId of minimizeTargets) {
      try {
        await minimizeWindow(exec, windowId);
      } catch (error) {
        errors.push(`${windowId}: ${error.message}`);
      }
    }

    if (errors.length) {
      throw new Error(errors.join("; "));
    }

    search?.clear?.();
  } catch (error) {
    const message = `Failed to hide other windows: ${error.message}`;
    if (toast?.error) {
      toast.error("Command failed", { description: message });
    }

    throw new Error(message);
  }
};

module.exports = { run, actions: [] };
