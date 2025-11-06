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
} = require("./utils");

const parseKeyValueOutput = (text) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce((acc, line) => {
      const [key, value] = line.split("=");
      if (key && value !== undefined) {
        acc[key.trim()] = value.trim();
      }
      return acc;
    }, {});

const parseMonitors = (xrandrOutput) =>
  xrandrOutput
    .split("\n")
    .map((line) => line.trim())
    .map((line) => {
      const match = line.match(
        /^([A-Za-z0-9-]+)\s+connected(?:\s+primary)?\s+(\d+)x(\d+)\+(\d+)\+(\d+)/
      );

      if (!match) {
        return null;
      }

      const [, name, width, height, x, y] = match;
      return {
        name,
        width: Number(width),
        height: Number(height),
        x: Number(x),
        y: Number(y),
      };
    })
    .filter(Boolean);

const findMonitorForWindow = (monitors, windowGeometry) => {
  const windowX = Number(windowGeometry.X);
  const windowY = Number(windowGeometry.Y);
  const windowWidth = Number(windowGeometry.WIDTH);
  const windowHeight = Number(windowGeometry.HEIGHT);

  if ([windowX, windowY, windowWidth, windowHeight].some(Number.isNaN)) {
    return null;
  }

  const centerX = windowX + windowWidth / 2;
  const centerY = windowY + windowHeight / 2;

  return (
    monitors.find(
      (monitor) =>
        centerX >= monitor.x &&
        centerX <= monitor.x + monitor.width &&
        centerY >= monitor.y &&
        centerY <= monitor.y + monitor.height
    ) || monitors[0] || null
  );
};

const SQUARE_SCALE = 0.5;
const WIDTH_BOOST = 1.50;
const DELAY_AFTER_UNMAXIMIZE_MS = 120;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

    const windowGeometry = parseKeyValueOutput(
      await execCommand(
        exec,
        `xdotool getwindowgeometry --shell ${targetWindowDec}`
      )
    );

    const monitors = parseMonitors(await execCommand(exec, "xrandr --current"));
    const monitor = findMonitorForWindow(monitors, windowGeometry);

    if (!monitor) {
      throw new Error("Unable to resolve monitor for the target window.");
    }

    const baseSize = Math.max(
      1,
      Math.round(Math.min(monitor.width, monitor.height) * SQUARE_SCALE)
    );
    const height = baseSize;
    const width = Math.max(
      1,
      Math.min(monitor.width, Math.round(baseSize * WIDTH_BOOST))
    );
    const x = monitor.x + Math.round((monitor.width - width) / 2);
    const y = monitor.y + Math.round((monitor.height - height) / 2);

    await execCommand(
      exec,
      `wmctrl -i -r ${targetWindowId} -e 0,${x},${y},${width},${height}`
    );
    search?.clear?.();
  } catch (error) {
    const message = `Failed to almost minimize: ${error.message}`;
    if (toast?.error) {
      toast.error("Command failed", { description: message });
    }

    throw new Error(message);
  }
};

module.exports = { run, actions: [] };
