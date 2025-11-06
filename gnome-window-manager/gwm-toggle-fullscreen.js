const { execCommand, ensureWmctrl, ensureXprop } = require("./utils");

const parseHexId = (text) => {
  const match = text.match(/0x[0-9a-f]+/i);
  return match ? match[0] : null;
};

const getStackingOrder = (text) => {
  const matches = text.match(/0x[0-9a-f]+/gi);
  return matches || [];
};

const isMaximized = (stateOutput) =>
  /_NET_WM_STATE_MAXIMIZED_VERT/.test(stateOutput) &&
  /_NET_WM_STATE_MAXIMIZED_HORZ/.test(stateOutput);

const run = async (_, { exec, toast, search }) => {
  await ensureWmctrl(exec, toast);
  await ensureXprop(exec, toast);

  const activeWindowId = parseHexId(
    await execCommand(exec, "xprop -root _NET_ACTIVE_WINDOW")
  );

  const stackingOrder = getStackingOrder(
    await execCommand(exec, "xprop -root _NET_CLIENT_LIST_STACKING")
  );

  const targetWindowId =
    stackingOrder
      .slice()
      .reverse()
      .find((id) => id !== activeWindowId && id !== "0x0") || activeWindowId;

  if (!targetWindowId) {
    throw new Error("Could not determine a window to toggle.");
  }

  try {
    const stateOutput = await execCommand(
      exec,
      `xprop -id ${targetWindowId} _NET_WM_STATE`
    );

    const maximized = isMaximized(stateOutput);
    const wmctrlCommand = maximized
      ? `wmctrl -i -r ${targetWindowId} -b remove,maximized_vert,maximized_horz`
      : `wmctrl -i -r ${targetWindowId} -b add,maximized_vert,maximized_horz`;

    await execCommand(exec, wmctrlCommand);
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
