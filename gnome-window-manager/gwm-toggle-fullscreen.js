const {
  execCommand,
  ensureWmctrl,
  ensureXprop,
  getTargetWindowId,
  isMaximizedState,
  updateWindowStates,
} = require("./utils");

const run = async (_, { exec, toast, search }) => {
  await ensureWmctrl(exec, toast);
  await ensureXprop(exec, toast);

  try {
    const { targetWindowId } = await getTargetWindowId(exec);

    const stateOutput = await execCommand(
      exec,
      `xprop -id ${targetWindowId} _NET_WM_STATE`
    );

    const maximized = isMaximizedState(stateOutput);

    if (maximized) {
      await updateWindowStates(exec, targetWindowId, "remove", [
        "maximized_vert",
        "maximized_horz",
      ]);
    } else {
      await updateWindowStates(exec, targetWindowId, "add", [
        "maximized_vert",
        "maximized_horz",
      ]);
    }
    search?.clear?.();
  } catch (error) {
    const message = `Failed to toggle fullscreen: ${error.message}`;
    if (toast?.error) {
      toast.error("Command failed", { description: message });
    }

    throw new Error(message);
  }
};

module.exports = { run, actions: [] };
