const {
  execCommand,
  ensureWmctrl,
  ensureXprop,
  getStackingOrder,
} = require("./utils");

const CLOSE_DELAY_MS = 50;
const BACKSLASH_IDENTIFIER = "backslash";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const extractQuotedValues = (text) => {
  const values = [];
  const regex = /"([^"]*)"/g;
  let match = regex.exec(text);

  while (match) {
    values.push(match[1]);
    match = regex.exec(text);
  }

  return values;
};

const closeWindow = async (exec, windowId) => {
  if (!windowId || windowId === "0x0") {
    return;
  }

  await execCommand(exec, `wmctrl -i -c ${windowId}`);
};

const isBackslashWindow = async (exec, windowId) => {
  if (!windowId || windowId === "0x0") {
    return false;
  }

  try {
    const output = await execCommand(exec, `xprop -id ${windowId} WM_CLASS WM_NAME`);
    const windowIdentifiers = extractQuotedValues(output).map((value) =>
      value?.toLowerCase?.() || ""
    );

    return windowIdentifiers.some((value) =>
      value.includes(BACKSLASH_IDENTIFIER)
    );
  } catch {
    // If we cannot inspect the window, err on the side of leaving it alone.
    return true;
  }
};

const run = async (_, { exec, toast, search }) => {
  await ensureWmctrl(exec, toast);
  await ensureXprop(exec, toast);

  try {
    const stackingOrder = await getStackingOrder(exec);

    if (!stackingOrder.length) {
      throw new Error("No tracked windows found to close.");
    }

    const errors = [];

    for (const windowId of stackingOrder) {
      try {
        if (await isBackslashWindow(exec, windowId)) {
          continue;
        }

        await closeWindow(exec, windowId);
        await delay(CLOSE_DELAY_MS);
      } catch (error) {
        errors.push(`${windowId}: ${error.message}`);
      }
    }

    if (errors.length) {
      throw new Error(errors.join("; "));
    }

    search?.clear?.();
  } catch (error) {
    const message = `Failed to quit applications: ${error.message}`;
    if (toast?.error) {
      toast.error("Command failed", { description: message });
    }

    throw new Error(message);
  }
};

module.exports = { run, actions: [] };
