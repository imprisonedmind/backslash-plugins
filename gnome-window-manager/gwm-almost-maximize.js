const {
  execCommand,
  ensureWmctrl,
  ensureXprop,
  ensureXdotool,
  ensureXrandr,
  getTargetWindowId,
  isMaximizedState,
  isFullscreenState,
  updateWindowStates,
  findMonitorForWindow,
  delay,
  getWindowGeometry,
  getMonitors,
} = require("./utils");

const SCALE = 0.8;
const DELAY_AFTER_UNMAXIMIZE_MS = 120;

const run = async (_, { exec, toast, search }) => {
  await ensureWmctrl(exec, toast);
  await ensureXprop(exec, toast);
  await ensureXdotool(exec, toast);
  await ensureXrandr(exec, toast);

  try {
    const { targetWindowId } = await getTargetWindowId(exec);
    const targetWindowDec = Number.parseInt(targetWindowId, 16);

    if (!Number.isFinite(targetWindowDec)) {
      throw new Error(`Invalid window id: ${targetWindowId}`);
    }

    const stateOutput = await execCommand(
      exec,
      `xprop -id ${targetWindowId} _NET_WM_STATE`
    );

    const wasMaximized = isMaximizedState(stateOutput);
    const wasFullscreen = isFullscreenState(stateOutput);

    if (wasMaximized || wasFullscreen) {
      await updateWindowStates(exec, targetWindowId, "remove", [
        "fullscreen",
        "maximized_vert",
        "maximized_horz",
      ]);
      await delay(DELAY_AFTER_UNMAXIMIZE_MS);
    }

    const windowGeometry = await getWindowGeometry(exec, targetWindowDec);

    const monitors = await getMonitors(exec);
    const monitor = findMonitorForWindow(monitors, windowGeometry);

    if (!monitor) {
      throw new Error("Unable to resolve monitor for the target window.");
    }

    const width = Math.max(1, Math.round(monitor.width * SCALE));
    const height = Math.max(1, Math.round(monitor.height * SCALE));
    const x = monitor.x + Math.round((monitor.width - width) / 2);
    const y = monitor.y + Math.round((monitor.height - height) / 2);

    await execCommand(exec, `wmctrl -i -r ${targetWindowId} -e 0,${x},${y},${width},${height}`);
    search?.clear?.();
  } catch (error) {
    const message = `Failed to almost maximize: ${error.message}`;
    if (toast?.error) {
      toast.error("Command failed", { description: message });
    }

    throw new Error(message);
  }
};

module.exports = { run, actions: [] };
