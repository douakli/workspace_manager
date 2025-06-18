const LOG_LEVEL = 1; // 0 trace, 1 debug, 2 info


function log(...args) { print("[dynamic_workspaces] ", ...args); }
function debug(...args) { if (LOG_LEVEL <= 1)  log(...args); }
function trace(...args) { if (LOG_LEVEL <= 0)  log(...args); }

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function enumerate_obj(obj) {
    for (let key in obj) {
        console.log(key);
    }
}

/**
 * Adds one desktop at the end of the list.
 *
 * To be used by addRow and addColumn.
 *
 * @param position optional
 */
const _addDesktop = function (position, name) {
    let target = position;
    if (target === undefined) {
        target = workspace.desktops.length;
    }
    workspace.createDesktop(target, name);
};

/**
 * Adds a given number of desktops.
 *
 * @param count the number of desktops to add.
 */
const _addDesktops = function(count) {
    for (let i = 0; i < count; i++) {
        _addDesktop();
    }
}

/**
 * Removes one desktop at the end of the list.
 *
 * Instead of removing other desktops, shift all the other ones to have an
 * empty desktop at the end of the list.
 *
 * @param animate When true, animates the switch.
 */
const _deleteDesktop = function(animate) {
    try {
        const last = workspace.desktops[workspace.desktops.length - 1];

        // replay the animation by switching again
        const current = workspace.currentDesktop;
        const index = workspace.desktops.indexOf(current);

        // in any weird corner case switch to current desktop
        const target = index + 1 < workspace.desktops.length || index === -1
            ? workspace.desktops[index + 1]
            : current;

        if (animate) {
            workspace.currentDesktop = target;
        }
        workspace.removeDesktop(last);
        if (animate) {
            workspace.currentDesktop = current;
        }
    } finally {}
};

const _deleteDesktops = function(count, animate) {
    for (let i = 0; i < count; i++) {
        _deleteDesktop(animate)
    }
}


/**
 * Gets the list of windows on the given desktop.
 *
 * @param desktop the desktop to find windows for
 * @return The list of windows for the given desktop
 */
const _windowsOfDesktop = function(desktop) {
    const allWindows = workspace.windowList();
    const windows = [];
    for (let i = 0; i < allWindows.length; i++) {
        const win = allWindows[i];

        if (win.desktops.indexOf(desktop) !== -1) {
            windows.push(win);
        }
    }

    return windows;
};

/**
 * Gets the list of desktops on a given row.
 *
 * @param the index of the row
 * @return the list of desktops in the row
 */
const _getRow = function(index) {
    const count = workspace.desktops.length;
    const rows = workspace.desktopGridHeight;
    const cols = workspace.desktopGridWidth;

    const limit = max(count, (index+1)*cols);

    const desktops = [];
    for (let i=index*cols; i < limit ; i++) {
        desktops.push(workspace.desktops[i]);
    }

    return desktops;
}

/**
 * Sends all windows from a desktop to another.
 *
 * @param sender the desktop to take the windows from
 * @param recipient the desktop that will recieve the sender's windows
 */
const _sendAllWindows = function(sender, recipient) {
    const windows = _windowsOfDesktop(sender);

    for (let i = 0; i < windows.length; i++) {
        const win = windows[i];
        const winDesktops = win.desktops.map(desktop => desktop == sender ? recipient : desktop);
        win.desktops = winDesktops;
    }
}

/**
 * Shift clients across desktops in **1D** space towards the right.
 *
 * After calling this function:
 *   Desktop at start will be empty.
 *   For each i in [start,end], desktop at i+1 will have received the clients from desktop at i.
 *   Note that the desktop at end+1 will receive clients.
 *
 * @param start index of the first desktop of the range
 * @param end index of the last desktop of the range
 */
const _shiftClientsRight = function(start, end, offset) {

    if (offset) {
        for (let i = 0; i<offset; i++) {
            _shiftClientsRight(start+i, end+i);
        }
        return;
    }

    const desktops = workspace.desktops;

    for (let i = end; i >= start; i--) {
        _sendAllWindows(desktops[i], desktops[i+1]);
    }
}

/**
 * Shifts clients across desktops in **1D** space towards the left.
 *
 * After calling this function:
 *   Desktop at end will be empty.
 *   For each i in [start, end], desktop at i-1 will have received the clients from desktop at i.
 *   Note that the destop at start-1 will receive clients.
 *
 * @param start index of the first desktop of the range
 * @param end index of the last desktop of the range
 */
const _shiftClientsLeft = function(start, end) {

    if (offset) {
        for (let i = 0; i<offset; i++) {
            _shiftClientsLeft(start+i, end+i);
        }
        return;
    }

    const desktops = workspace.desktops;

    for (let i = start; i <= end; i++) {
        _sendAllWindows(desktops[i], desktops[i-1]);
    }
}

/**
 * Adds a new empty row of desktops at the bottom of the grid.
 */
const appendRow = function() {
    const rows = workspace.desktopGridHeight
    const cols = workspace.desktopGridWidth
    const count = workspace.desktops.length

    _addDesktops(cols);

    workspace.desktopGridHeight = rows + 1
}

/**
 * Adds a new empty row of desktops at the top of the grid.
 */
const prependRow = function() {
    const current = workspace.currentDesktop;
    const index = workspace.desktops.indexOf(current);

    const count = workspace.desktops.length;
    const rows = workspace.desktopGridHeight;
    const cols = workspace.desktopGridWidth;
    appendRow();
    _shiftClientsRight(0, count - 1, cols);
    workspace.currentDesktop = workspace.desktops[index+cols]
}

// console.log(_addDesktops(20));
// appendRow();
// prependRow();
// workspace.desktopGridHeight = 1;

// enumerate_obj(workspace.windowList());
// console.log("test");
// _shiftClientsRight(8,12);
// _shiftClientsLeft(9,13);

/**
 * Entrypoint.
 */

// // Adding or removing a client might create desktops.
// // For all existing clients:
// compat.windowList(workspace).forEach(onClientAdded);
// // And for all future clients:
// compat.windowAddedSignal(workspace).connect(onClientAdded);
//
// // Switching desktops might remove desktops
// workspace.currentDesktopChanged.connect(onDesktopSwitch);
