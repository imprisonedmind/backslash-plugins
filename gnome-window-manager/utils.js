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

const ensureXdotool = (exec, toast) =>
  ensureDependency(exec, toast, {
    binary: "xdotool",
    installHint: "Install it with: sudo apt install xdotool",
  });

const ensureXrandr = (exec, toast) =>
  ensureDependency(exec, toast, {
    binary: "xrandr",
    installHint: "Install it with: sudo apt install x11-xserver-utils",
  });

const hasWindowState = (stateOutput, state) =>
  new RegExp(state.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&")).test(stateOutput);

const isMaximizedState = (stateOutput) =>
  hasWindowState(stateOutput, "_NET_WM_STATE_MAXIMIZED_VERT") &&
  hasWindowState(stateOutput, "_NET_WM_STATE_MAXIMIZED_HORZ");

const isFullscreenState = (stateOutput) =>
  hasWindowState(stateOutput, "_NET_WM_STATE_FULLSCREEN");

const parseHexId = (text) => {
  const match = text.match(/0x[0-9a-f]+/i);
  return match ? match[0] : null;
};

const extractHexIds = (text) => text.match(/0x[0-9a-f]+/gi) || [];

const getActiveWindowId = async (exec) =>
  parseHexId(await execCommand(exec, "xprop -root _NET_ACTIVE_WINDOW"));

const getStackingOrder = async (exec) =>
  extractHexIds(await execCommand(exec, "xprop -root _NET_CLIENT_LIST_STACKING"));

const pickTargetWindowId = (activeWindowId, stackingOrder) =>
  stackingOrder
    .slice()
    .reverse()
    .find((id) => id !== activeWindowId && id !== "0x0") || activeWindowId;

const getTargetWindowId = async (exec) => {
  const activeWindowId = await getActiveWindowId(exec);
  const stackingOrder = await getStackingOrder(exec);
  const targetWindowId = pickTargetWindowId(activeWindowId, stackingOrder);

  if (!targetWindowId) {
    throw new Error("Could not determine a window to operate on.");
  }

  return { targetWindowId, activeWindowId };
};

const updateWindowStates = async (exec, windowId, operation, states) => {
  const values = Array.isArray(states) ? states : [states];

  for (const state of values) {
    await execCommand(exec, `wmctrl -i -r ${windowId} -b ${operation},${state}`);
  }
};

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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getWindowGeometry = async (exec, windowIdDecimal) =>
  parseKeyValueOutput(
    await execCommand(exec, `xdotool getwindowgeometry --shell ${windowIdDecimal}`)
  );

const getMonitors = async (exec) =>
  parseMonitors(await execCommand(exec, "xrandr --current"));

module.exports = {
  execCommand,
  ensureDependency,
  ensureWmctrl,
  ensureXprop,
  ensureXdotool,
  ensureXrandr,
  parseHexId,
  extractHexIds,
  getActiveWindowId,
  getStackingOrder,
  getTargetWindowId,
  hasWindowState,
  isMaximizedState,
  isFullscreenState,
  updateWindowStates,
  parseKeyValueOutput,
  parseMonitors,
  findMonitorForWindow,
  delay,
  getWindowGeometry,
  getMonitors,
};
