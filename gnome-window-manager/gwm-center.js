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

    const width = Number(windowGeometry.WIDTH);
    const height = Number(windowGeometry.HEIGHT);

    if ([width, height].some((value) => !Number.isFinite(value))) {
      throw new Error("Unable to determine window dimensions.");
    }

    const monitors = await getMonitors(exec);
    const monitor = findMonitorForWindow(monitors, windowGeometry);

    if (!monitor) {
      throw new Error("Unable to resolve monitor for the target window.");
    }

    const centeredX = monitor.x + Math.round((monitor.width - width) / 2);
    const centeredY = monitor.y + Math.round((monitor.height - height) / 2);

    const maxX = monitor.x + Math.max(0, monitor.width - width);
    const maxY = monitor.y + Math.max(0, monitor.height - height);

    const x = Math.min(Math.max(centeredX, monitor.x), maxX);
    const y = Math.min(Math.max(centeredY, monitor.y), maxY);

    await execCommand(
      exec,
      `wmctrl -i -r ${targetWindowId} -e 0,${x},${y},${width},${height}`
    );
    search?.clear?.();
  } catch (error) {
    const message = `Failed to center window: ${error.message}`;
    if (toast?.error) {
      toast.error("Command failed", { description: message });
    }

    throw new Error(message);
  }
};

module.exports = { run, actions: [] };
