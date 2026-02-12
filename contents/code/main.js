const LOG_LEVEL = 1; // 0 trace, 1 debug, 2 info

function max(a, b) { return a >= b ? a : b } ;
function min(a, b) { return a <= b ? a : b } ;

function log(...args) { print("[dynamic_workspaces] ", ...args); }
function debug(...args) { if (LOG_LEVEL <= 1)  log(...args); }
function trace(...args) { if (LOG_LEVEL <= 0)  log(...args); }

// General config
const CFG_CURRENT_DESKTOP_IS_ALWAYS_USED = "currentDesktopIsAlwaysUsed";
const CFG_CURRENT_DESKTOP_IS_ALWAYS_USED_DEFAULT = false;
const CFG_OPTIMISE_ACTIVITY_OVERLAP = "optimiseActivityOverlap";
const CFG_OPTIMISE_ACTIVITY_OVERLAP_DEFAULT = false;

// Middle cleanup config
const CFG_CLEANUP_MIDDLE_ROW = "cleanupMiddleRow";
const CFG_CLEANUP_MIDDLE_ROW_DEFAULT = false;
const CFG_CLEANUP_MIDDLE_ROW_DIRECTION = "cleanupMiddleRowDirection";
const CFG_CLEANUP_MIDDLE_ROW_DIRECTION_DEFAULT = 0;
const CFG_CLEANUP_MIDDLE_COL = "cleanupMiddleCol";
const CFG_CLEANUP_MIDDLE_COL_DEFAULT = false;
const CFG_CLEANUP_MIDDLE_COL_DIRECTION = "cleanupMiddleColDirection";
const CFG_CLEANUP_MIDDLE_COL_DIRECTION_DEFAULT = 0;

// Advanced config
const CFG_SWAP_DESKTOPS_WHEN_POSSIBLE = "swapDesktopsWhenPossible"
const CFG_SWAP_DESKTOPS_WHEN_POSSIBLE_DEFAULT = false;
const CFG_ALWAYS_USE_ACTIVITY_LAST_VIRTUAL_DESKTOP_COMPATIBILITY_LAYER = "alwaysUseActivityLastVirtualDesktopCompatibilityLayer"
const CFG_ALWAYS_USE_ACTIVITY_LAST_VIRTUAL_DESKTOP_COMPATIBILITY_LAYER_DEFAULT = false;
const CFG_MAX_VIRTUAL_DESKTOPS = "maxVirtualDesktops";
const CFG_MAX_VIRTUAL_DESKTOPS_DEFAULT = 20;
const CFG_CURRENT_DESKTOP_CHANGED_DELAY = "currentDesktopChangedDelay";
const CFG_CURRENT_DESKTOP_CHANGED_DELAY_DEFAULT = 0;
const CFG_WINDOW_MOVED_DELAY = "windowMovedDelay";
const CFG_WINDOW_MOVED_DELAY_DEFAULT = 0;
const CFG_WINDOW_ADDED_DELAY = "windowAddedDelay";
const CFG_WINDOW_ADDED_DELAY_DEFAULT = 0;
const CFG_WINDOW_CLOSED_DELAY = "windowClosedDelay";
const CFG_WINDOW_CLOSED_DELAY_DEFAULT = 0;
const CFG_ACTIVITY_COMPAT_LAYER_CURRENT_DESKTOP_CHANGED_DELAY = "activityCompatLayerCurrentDesktopChangedDelay";
const CFG_ACTIVITY_COMPAT_LAYER_CURRENT_DESKTOP_CHANGED_DELAY_DEFAULT = 0;
const CFG_ACTIVITY_COMPAT_LAYER_CURRENT_ACTIVITY_CHANGED_DELAY = "activityCompatLayerCurrentActivityChangedDelay";
const CFG_ACTIVITY_COMPAT_LAYER_CURRENT_ACTIVITY_CHANGED_DELAY_DEFAULT = 5;

// Directional config
const CFG_TOP_EDGE_POLICY = "topEdgePolicy";
const CFG_TOP_EDGE_POLICY_DEFAULT = 0;
const CFG_LEFT_EDGE_POLICY = "leftEdgePolicy";
const CFG_LEFT_EDGE_POLICY_DEFAULT = 0;
const CFG_RIGHT_EDGE_POLICY = "rightEdgePolicy";
const CFG_RIGHT_EDGE_POLICY_DEFAULT = 0;
const CFG_BOTTOM_EDGE_POLICY = "bottomEdgePolicy";
const CFG_BOTTOM_EDGE_POLICY_DEFAULT = 0;

function osd(message) {
    callDBus(
        "org.freedesktop.Notifications",
        "/org/kde/osdService",
        "org.kde.osdService",
        "showText",
        "window-list",
        message
    );
}


function toColumn(n) {
  if (n < 1) throw new Error("Columns start at 1");
  let result = '';
  while (n > 0) {
    n--; // adjust for 1-based indexing
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

function sleep(ms) {
    return new Promise((resolve) => {
        if (ms == 0) {
            return resolve();
        }

        const timer = new QTimer()
        timer.interval = ms;
        timer.timeout.connect(resolve);
        timer.singleShot = true;
        timer.start();
    });
}

var lastVirtualDesktopCompatLayer;

class LastVirtualDesktopCompatLayer {
    constructor() {
        this.native = workspace.lastVirtualDesktop && !readConfig(CFG_ALWAYS_USE_ACTIVITY_LAST_VIRTUAL_DESKTOP_COMPATIBILITY_LAYER, CFG_ALWAYS_USE_ACTIVITY_LAST_VIRTUAL_DESKTOP_COMPATIBILITY_LAYER_DEFAULT);

        if (!this.native) {
            this.e_tracker = {};
            this.e_tracker[workspace.currentActivity] = workspace.currentDesktop;
            this.e_registerListeners();
        }

    }

    // Native support
    n_lastVirtualDesktop(activity) {
        return workspace.lastVirtualDesktop(activity);
    }

    n_setLastVirtualDesktop(activity, desktop) {
        workspace.setLastVirtualDesktop(activity, desktop);
    }

    // Emulated support

    e_lastVirtualDesktop(activity) {
        return this.e_tracker[activity]?.last;
    }

    e_setLastVirtualDesktop(activity, desktop) {
        if (!(activity in this.e_tracker)) {
            this.e_tracker[activity] = {};
        }
        this.e_tracker[activity].penultimate = this.e_tracker[activity]?.last;
        this.e_tracker[activity].last = desktop;
        console.log(e_tracker);
    }

    e_onCurrentDesktopChanged(oldDesktop) {
        const currentDesktop = workspace.currentDesktop;
        const currentActivity = workspace.currentActivity;
        sleep(readConfig(CFG_ACTIVITY_COMPAT_LAYER_CURRENT_DESKTOP_CHANGED_DELAY, CFG_ACTIVITY_COMPAT_LAYER_CURRENT_DESKTOP_CHANGED_DELAY_DEFAULT)).then(() => {
            lastVirtualDesktopCompatLayer.setLastVirtualDesktop(currentActivity, currentDesktop);
        })
    }

    e_onCurrentActivityChanged(activity) {
        const desktop = lastVirtualDesktopCompatLayer.e_tracker[activity]?.penultimate;
        sleep(readConfig(CFG_ACTIVITY_COMPAT_LAYER_CURRENT_ACTIVITY_CHANGED_DELAY, CFG_ACTIVITY_COMPAT_LAYER_CURRENT_ACTIVITY_CHANGED_DELAY_DEFAULT)).then(() => {
            if (desktop && workspace.desktops.includes(desktop)) {
                workspace.currentDesktop = desktop;
            }
        })

    }

    e_registerListeners() {
        workspace.currentDesktopChanged.connect(this.e_onCurrentDesktopChanged);
        workspace.currentActivityChanged.connect(this.e_onCurrentActivityChanged);
    }

    // Dispatcher

    lastVirtualDesktop(activity) {
        if (this.native) {
            return this.n_lastVirtualDesktop(activity);
        } else {
            return this.e_lastVirtualDesktop(activity);
        }
    }

    setLastVirtualDesktop(activity, desktop) {
        if (this.native) {
            return this.n_setLastVirtualDesktop(activity, desktop);
        } else {
            return this.e_setLastVirtualDesktop(activity, desktop);
        }
    }
}

lastVirtualDesktopCompatLayer = new LastVirtualDesktopCompatLayer();

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
const _deleteDesktop = function(noFix) {
    try {
        const last = workspace.desktops[workspace.desktops.length - 1];

        // replay the animation by switching again
        const current = workspace.currentDesktop;
        const index = workspace.desktops.indexOf(current);

        // in any weird corner case switch to current desktop
        const target = index + 1 < workspace.desktops.length || index === -1
            ? workspace.desktops[index + 1]
            : current;

        if (!noFix) {
            workspace.currentDesktop = target;
        }
        workspace.removeDesktop(last);
        if (!noFix) {
            workspace.currentDesktop = current;
        }
    } finally {}
};

const _deleteDesktops = function(count, noFix) {
    for (let i = 0; i < count; i++) {
        _deleteDesktop(noFix)
    }
}


/**
 * Gets the list of windows on the given desktop.
 *
 * @param desktop the desktop to find windows for
 * @param activity if present, only select windows that are on the given activity
 * @return The list of windows for the given desktop
 */
const _windowsOfDesktop = function(desktop, activity) {
    const allWindows = workspace.windowList().filter((win) => activity? (win.activities? win.activities.includes(activity) : true) : true);
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
 * Checks if the given desktops are emtpy.
 *
 * @param desktops the array of desktop to check for.
 * @param checkForCurrentDesktop force check for the current desktop
 */
const _areDesktopsEmpty = function(desktops, checkForCurrentDesktop, activity) {
    return desktops.reduce((acc, desktop) => {return acc && _windowsOfDesktop(desktop, activity).filter(win => !win.skipPager && !win.onAllDesktops && !win.skipSwitcher && !win.skipTaskbar).length === 0 && ((!checkForCurrentDesktop && !readConfig(CFG_CURRENT_DESKTOP_IS_ALWAYS_USED, CFG_CURRENT_DESKTOP_IS_ALWAYS_USED_DEFAULT)) || !(activity? desktop == (workspace.currentActivity == activity? workspace.currentDesktop : lastVirtualDesktopCompatLayer.lastVirtualDesktop(activity)) : [workspace.currentDesktop].concat(workspace.activities.filter((act) => workspace.currentActivity != act).map((act) => lastVirtualDesktopCompatLayer.lastVirtualDesktop(act))).includes(desktop)))}, true)
}


/**
 * Gets the list of desktops on a given row.
 *
 * @param index the index of the row
 * @return the list of desktops in the row
 */
const _getRow = function(index) {
    const count = workspace.desktops.length;
    const rows = workspace.desktopGridHeight;
    const cols = workspace.desktopGridWidth;

    if (index < 0 || index >= rows) {
        return [];
    }

    const limit = min(count, (index+1)*cols);
    const desktops = [];
    for (let i=index*cols; i < limit ; i++) {
        desktops.push(workspace.desktops[i]);
    }

    if (desktops.length === 0 && index == (rows-1)) {
        workspace.desktopGridHeight -= 1;
    }

    return desktops;
}

/**
 * Gets the list of desktops on a given column
 *
 * @param index the index of the column
 * @return the list of desktops in the column
 */
const _getColumn = function(index) {
    const count = workspace.desktops.length;
    const rows = workspace.desktopGridHeight;
    const cols = workspace.desktopGridWidth;

    if (index < 0 || index >= cols) {
        return [];
    }

    const columnLength = index <= ( (count - 1) % cols ) ? rows : rows - 1;

    const desktops = []
    for (let i = 0; i < columnLength; i++) {
        desktops.push(workspace.desktops[i*cols + index]);
    }

    return desktops;
}

/**
 * Sends all windows from a desktop to another.
 *
 * @param sender the desktop to take the windows from
 * @param recipient the desktop that will recieve the sender's windows
 */
const _sendAllWindows = function(sender, recipient, activity) {

    if (!activity && readConfig(CFG_SWAP_DESKTOPS_WHEN_POSSIBLE, CFG_SWAP_DESKTOPS_WHEN_POSSIBLE_DEFAULT) && workspace.moveDesktop) {
        const destIndex = workspace.desktops.indexOf(recipient);
        const sourceIndex = workspace.desktops.indexOf(sender);
        workspace.moveDesktop(sender, destIndex);
        workspace.moveDesktop(recipient, sourceIndex);
    } else {
        const windows = _windowsOfDesktop(sender, activity);

        for (let i = 0; i < windows.length; i++) {
            const win = windows[i];
            const winDesktops = win.desktops.map(desktop => desktop == sender ? recipient : desktop);
            win.desktops = winDesktops;
        }
    }
}

/**
 * Shift clients across desktops in **1D** space towards the right.
 *
 * After calling this function:
 *   Desktop at start will be empty.
 *   For each i in [start,end], desktop at i+offset will have received the clients from desktop at i.
 *   Note that the desktop at from end to end+offset will receive clients.
 *
 * @param start index of the first desktop of the range
 * @param end index of the last desktop of the range
 * @param offset number of desktop to shift by
 * @param noFollow when true, do not shift the currentDesktop even if it is in the range
 */
const _shiftClientsRight = function(start, end, offset, noFollow, targetActivity) {
    const current = workspace.currentDesktop;
    const currIndex = workspace.desktops.indexOf(current);
    const realOffset = offset === undefined ? 1 : offset;

    if (realOffset) {

        for (let i = 0; i<realOffset; i++) {
            _shiftClientsRight(start+i, end+i, null, undefined, targetActivity);
        }


        if (!noFollow) {

            workspace.activities.filter((activity) => (activity != workspace.currentActivity) && (!targetActivity || activity == targetActivity)).forEach((activity) => {
                const actCurrent = lastVirtualDesktopCompatLayer.lastVirtualDesktop(activity);
                const actCurrIndex = workspace.desktops.indexOf(actCurrent);

                if (actCurrIndex >= start && actCurrIndex <= end) {
                    lastVirtualDesktopCompatLayer.setLastVirtualDesktop(activity, workspace.desktops[actCurrIndex + realOffset]);
                }
            })

            if (currIndex >= start && currIndex <= end && (!targetActivity || targetActivity == workspace.currentActivity)) {
                workspace.currentDesktop = workspace.desktops[currIndex + realOffset];
            }
        }

        return;
    }

    for (let i = end; i >= start; i--) {
        _sendAllWindows(workspace.desktops[i], workspace.desktops[i+1], targetActivity);
    }
}

/**
 * Shifts clients across desktops in **1D** space towards the left.
 *
 * After calling this function:
 *   Desktops in the range of [end - offset + 1, end] will be empty.
 *   For each i in [start, end], desktop at i-offset will have received the clients from desktop at i.
 *   Note that the destops before start, up to start-offset will receive clients.
 *
 * @param start index of the first desktop of the range
 * @param end index of the last desktop of the range
 * @param offset number of desktop to shift by
 * @param noFollow when true, do not shift the currentDesktop even if it is in the range
 */
const _shiftClientsLeft = function(start, end, offset, noFollow, targetActivity) {
    const current = workspace.currentDesktop;
    const currIndex = workspace.desktops.indexOf(current);
    const count = workspace.desktops.length;
    const realOffset = offset === undefined ? 1 : offset;

    if (realOffset) {

        for (let i = 0; i<realOffset; i++) {
            _shiftClientsLeft(start-i, end-i, null, undefined, targetActivity);
        }

        if (!noFollow) {

            workspace.activities.filter((activity) => (activity != workspace.currentActivity) && (!targetActivity || activity == targetActivity)).forEach((activity) => {
                const actCurrent = lastVirtualDesktopCompatLayer.lastVirtualDesktop(activity);
                const actCurrIndex = workspace.desktops.indexOf(actCurrent);

                if (actCurrIndex >= start && actCurrIndex <= end) {
                    lastVirtualDesktopCompatLayer.setLastVirtualDesktop(activity, workspace.desktops[actCurrIndex - realOffset]);
                }
            })

            if (currIndex >= start && currIndex <= end && (!targetActivity || targetActivity == workspace.currentActivity)) {
                workspace.currentDesktop = workspace.desktops[currIndex - realOffset];
            }
    }

        return;
    }

    for (let i = start; i <= end; i++) {
        _sendAllWindows(workspace.desktops[i], workspace.desktops[i-1], targetActivity);
    }
}

/**
 * Adds a new empty row of desktops at the bottom of the grid.
 */
const appendRow = function() {
    const maxVirtualDesktops = readConfig(CFG_MAX_VIRTUAL_DESKTOPS, CFG_MAX_VIRTUAL_DESKTOPS_DEFAULT);

    const rows = workspace.desktopGridHeight
    const cols = workspace.desktopGridWidth
    const count = workspace.desktops.length

    if (count + cols > maxVirtualDesktops) {
        return;
    }

    _addDesktops(cols);

    workspace.desktopGridHeight = rows + 1
}

/**
 * Adds a new empty row of desktops at the top of the grid.
 */
const prependRow = function() {
    const maxVirtualDesktops = readConfig(CFG_MAX_VIRTUAL_DESKTOPS, CFG_MAX_VIRTUAL_DESKTOPS_DEFAULT);

    const count = workspace.desktops.length;
    const rows = workspace.desktopGridHeight;
    const cols = workspace.desktopGridWidth;

    if (count + cols > maxVirtualDesktops) {
        return;
    }

    appendRow();
    _shiftClientsRight(0, count - 1, cols);
}

/**
 * Adds a new empty column of desktops at the right of the grid.
 */
const appendColumn = function() {
    const maxVirtualDesktops = readConfig(CFG_MAX_VIRTUAL_DESKTOPS, CFG_MAX_VIRTUAL_DESKTOPS_DEFAULT);

    const count = workspace.desktops.length;
    const rows = workspace.desktopGridHeight;
    const cols = workspace.desktopGridWidth;

    if (count + rows > maxVirtualDesktops) {
        return;
    }

    _addDesktops(rows);

    for (let i = rows - 1; i > 0; i--) {

        // The way I thought about the arithmetics here is:
        // "I want to move one of the new desktops in the correct spot"
        //
        // From my analysis, count + rows - i is the index of the leftmost
        // newly created desktop that hasn't been used yet.
        _shiftClientsRight(i*cols, count + rows - i);
    }
}

/**
 * Adds a new empty column of desktops at the left of the grid.
 */
const prependColumn = function() {
    const maxVirtualDesktops = readConfig(CFG_MAX_VIRTUAL_DESKTOPS, CFG_MAX_VIRTUAL_DESKTOPS_DEFAULT);

    const count = workspace.desktops.length;
    const rows = workspace.desktopGridHeight;
    const cols = workspace.desktopGridWidth;

    if (count + rows > maxVirtualDesktops) {
        return;
    }

    _addDesktops(rows);
    for (let i = rows - 1; i >= 0; i--) {
        _shiftClientsRight(i*cols, count + rows - i);
    }
}


/**
 * If the column of given index is empty, delete it.
 *
 * @param index the index of the column to delete
 * @return true when the deletion was successful, false otherwise.
 */
const deleteColumn = function(index) {
    const count = workspace.desktops.length;
    const rows = workspace.desktopGridHeight;
    const cols = workspace.desktopGridWidth;

    if (cols <= 1) {
        return;
    }

    const column = _getColumn(index)
    const columnLength = column.length;
    const isColumnEmpty = _areDesktopsEmpty(column, true);

    if (!isColumnEmpty) {
        return;
    }

    for (let i = columnLength - 1; i >= 0; i--) {
        _shiftClientsLeft(i*cols + index + 1, count)
    }

    _deleteDesktops(columnLength);

    return true;
}

/**
 * If the row of given index is empty, delete it.
 *
 * @param index the index of the row to delete
 * @return true when the deletion was successful, false otherwise.
 */
const deleteRow = function(index) {
    const count = workspace.desktops.length;
    const rows = workspace.desktopGridHeight;
    const cols = workspace.desktopGridWidth;

    if (rows <= 1) {
        return;
    }

    const row = _getRow(index);
    const rowLength = row.length;
    const isRowEmpty = _areDesktopsEmpty(row, true);

    if (!isRowEmpty) {
        return;
    }

    // The row should be empty.
    // We want to shift anything that is after the row back into it.
    _shiftClientsLeft(index*cols + rowLength, count-1, rowLength);

    _deleteDesktops(rowLength);

    if (rowLength) {
        workspace.desktopGridHeight = rows - 1;
    }

    return true;
}

var updating = false;
const maybeUpdateLayout = function(recursed) {

    if (!recursed) {

        if (updating) {

            return;

        } else {

            try {
            updating = true;
            maybeUpdateLayout(1);
            } finally {
                updating = false;
                return;
            }

        }
    }

    // Too many recursions.
    if (recursed > 10) {
        return;
    }

    const count = workspace.desktops.length;
    const rows = workspace.desktopGridHeight;
    const cols = workspace.desktopGridWidth;

    const topEdgePolicy = readConfig(CFG_TOP_EDGE_POLICY, CFG_TOP_EDGE_POLICY_DEFAULT);
    const leftEdgePolicy = readConfig(CFG_LEFT_EDGE_POLICY, CFG_LEFT_EDGE_POLICY_DEFAULT);
    const rightEdgePolicy = readConfig(CFG_RIGHT_EDGE_POLICY, CFG_RIGHT_EDGE_POLICY_DEFAULT);
    const bottomEdgePolicy = readConfig(CFG_BOTTOM_EDGE_POLICY, CFG_BOTTOM_EDGE_POLICY_DEFAULT);
    const optimiseActivityOverlap = readConfig(CFG_OPTIMISE_ACTIVITY_OVERLAP, CFG_OPTIMISE_ACTIVITY_OVERLAP_DEFAULT);


    const cleanupMiddleRow = readConfig(CFG_CLEANUP_MIDDLE_ROW, CFG_CLEANUP_MIDDLE_ROW_DEFAULT);
    const cleanupMiddleRowDirection = readConfig(CFG_CLEANUP_MIDDLE_ROW_DIRECTION, CFG_CLEANUP_MIDDLE_ROW_DIRECTION_DEFAULT);
    const cleanupMiddleCol = readConfig(CFG_CLEANUP_MIDDLE_COL, CFG_CLEANUP_MIDDLE_COL_DEFAULT);
    const cleanupMiddleColDirection = readConfig(CFG_CLEANUP_MIDDLE_COL_DIRECTION, CFG_CLEANUP_MIDDLE_COL_DIRECTION_DEFAULT);


    // Always have at least one Desktop to have a valid grid.

    if (count < 1) {
        _addDesktop();
        return maybeUpdateLayout(recursed + 1);
    }

    // Desktop Coordinate naming

    for (const desktop of workspace.desktops) {
        const indexOfDesktop = workspace.desktops.indexOf(desktop);
        const i = Math.floor(indexOfDesktop / cols) + 1;
        const j = (indexOfDesktop % cols) + 1;

        const targetName = toColumn(j) + i.toString()

        if (desktop.name != targetName) {
            desktop.name = targetName;
        }
    }

    // -- Activity Overlap --

    if (optimiseActivityOverlap) {
        for (const activity of workspace.activities) {
            if (activity != workspace.currentActivity && !lastVirtualDesktopCompatLayer.lastVirtualDesktop(activity)) {
                continue;
            }

            const emptyActivity = _areDesktopsEmpty(workspace.desktops, false, activity);// || true;

            const shiftUp = function() {
                const firstRow = _getRow(0);
                const firstRowLength = firstRow.length;
                _shiftClientsLeft(firstRowLength, count-1, firstRowLength, undefined, activity);
            }

            /*
             * WARNING: Always check that the last row is of length cols *BEFORE* calling.
             */
            const shiftDown = function() {
                _shiftClientsRight(0, count-cols, cols, undefined, activity);
            }

            if (topEdgePolicy == 1) {
                if (rows >= 2) {
                    if (_areDesktopsEmpty(_getRow(0), true, activity)) {
                        shiftUp();
                        return maybeUpdateLayout(recursed + 1);
                    }
                }
            } else if (topEdgePolicy == 0) {
                if (rows >= 3) {
                    if (_areDesktopsEmpty(_getRow(0).concat(_getRow(1)), emptyActivity, activity)) {
                        shiftUp();
                        return maybeUpdateLayout(recursed + 1);
                    }
                }
            } else if (_getRow(rows-1).length == cols) {
                if (bottomEdgePolicy == 1) {
                    if (rows >= 2) {
                        if (_areDesktopsEmpty(_getRow(rows-1), true, activity)) {
                            shiftDown();
                            return maybeUpdateLayout(recursed + 1);
                        }
                    }
                } else if (bottomEdgePolicy == 0) {
                    if (rows >= 3) {
                        if (_areDesktopsEmpty(_getRow(rows-1).concat(_getRow(rows-2)), emptyActivity, activity)) {
                            shiftDown();
                            return maybeUpdateLayout(recursed + 1);
                        }
                    }
                }
            }

            const shiftLeft = function() {
                const firstColumn = _getColumn(0);
                const firstColumnLength = firstColumn.length;

                for (let i = firstColumnLength - 1; i >= 0; i--) {
                    const limit = min((i+1)*cols, count) - 1;
                    _shiftClientsLeft(i*cols + 1, limit, undefined, undefined, activity);
                }
            }

            const shiftRight = function() {
                const firstColumn = _getColumn(0);
                const firstColumnLength = firstColumn.length;

                for (let i = firstColumnLength - 1; i >= 0; i--) {
                    const limit = min((i+1)*cols, count) - 2;
                    _shiftClientsRight(i*cols, limit, undefined, undefined, activity);
                }
            }

            if (leftEdgePolicy == 1) {
                if (cols >= 2) {
                    if (_areDesktopsEmpty(_getColumn(0), true, activity)) {
                        shiftLeft();
                        return maybeUpdateLayout(recursed + 1);
                    }
                }
            } else if (leftEdgePolicy == 0) {
                if (cols >= 3) {
                    if (_areDesktopsEmpty(_getColumn(0).concat(_getColumn(1)), emptyActivity, activity)) {
                        shiftLeft();
                        return maybeUpdateLayout(recursed + 1);
                    }
                }
            } else if (_getRow(rows-1).length == cols) {
                if (rightEdgePolicy == 1) {
                    if (cols >= 2) {
                        if (_areDesktopsEmpty(_getColumn(cols-1), true, activity)) {
                            shiftRight();
                            return maybeUpdateLayout(recursed + 1);
                        }
                    }
                } else if (rightEdgePolicy == 0) {
                    if (cols >= 3) {
                        if (_areDesktopsEmpty(_getColumn(cols-1).concat(_getColumn(cols-2)), emptyActivity, activity)) {
                            shiftRight();
                            return maybeUpdateLayout(recursed + 1);
                        }
                    }
                }
            }
        }
    }

    // -- Middle Row Cleanup --

    if (cleanupMiddleRow) {
        // Find the first empty and non buffer row.
        for (let i = 0 + (topEdgePolicy != 1); i < rows - (bottomEdgePolicy != 1); i++) {
            if (_areDesktopsEmpty(_getRow(i))) {

            }
        }
    }

    // -- Middle Column Cleanup --

    if (cleanupMiddleCol) {

    }

    // -- Up --

    const firstRow = _getRow(0);
    const isFirstRowEmpty = _areDesktopsEmpty(firstRow);

    if (!isFirstRowEmpty) {
        // Ensure there is an available row.
        if (topEdgePolicy <= 0) {
            prependRow();
            return maybeUpdateLayout(recursed + 1);
        }
    } else if (rows >= 2) {
        // Cleanup if too many rows.
        const secondRow = _getRow(1);
        const isSecondRowEmpty = _areDesktopsEmpty(secondRow);

        if (topEdgePolicy <= 1) {
            if (isSecondRowEmpty || topEdgePolicy == 1) {
                if (deleteRow(0)) return maybeUpdateLayout(recursed + 1);
            }
        }
    }

    // -- Down --

    const lastRow = _getRow(rows - 1);
    const isLastRowEmpty = _areDesktopsEmpty(lastRow);

    if (!isLastRowEmpty) {
        // Ensure there is an available row.
        if (bottomEdgePolicy <= 0) {
            appendRow();
            return maybeUpdateLayout(recursed + 1);
        }
    } else if (rows >= 2) {
        // Cleanup if too many rows.
        const penultimateRow = _getRow(rows - 2);
        const isPenultimateRowEmpty = _areDesktopsEmpty(penultimateRow);

        if (bottomEdgePolicy <= 1) {
            if (isPenultimateRowEmpty || bottomEdgePolicy == 1) {
                if (deleteRow(rows - 1)) return maybeUpdateLayout(recursed + 1);
            }
        }
    }

    // -- Left --

    const firstColumn = _getColumn(0);
    const isFirstColumnEmpty = _areDesktopsEmpty(firstColumn);

    if (!isFirstColumnEmpty) {
        // Ensure there is an available column.
        if (leftEdgePolicy <= 0) {
            prependColumn();
            return maybeUpdateLayout(recursed + 1);
        }
    } else if (cols >= 2) {
        // Cleanup if too many columns.
        const secondColumn = _getColumn(1);
        const isSecondColumnEmpty = _areDesktopsEmpty(secondColumn);

        if (leftEdgePolicy <= 1) {
            if (isSecondColumnEmpty || leftEdgePolicy == 1) {
                if (deleteColumn(0)) return maybeUpdateLayout(recursed + 1);
            }
        }
    }

    // -- Right --
    const lastColumn = _getColumn(cols - 1);
    const isLastColumnEmpty = _areDesktopsEmpty(lastColumn);

    if (!isLastColumnEmpty) {
        // Ensure there is an available column.
        if (rightEdgePolicy <= 0) {
            appendColumn();
            return maybeUpdateLayout(recursed + 1);
        }
    } else if (cols >= 2) {
        // Cleanup if too many columns.
        const penultimateColumn = _getColumn(cols - 2);
        const isPenultimateColumnEmpty = _areDesktopsEmpty(penultimateColumn);

        if (rightEdgePolicy <= 1) {
            if (isPenultimateColumnEmpty || rightEdgePolicy == 1) {
                if (deleteColumn(cols - 1)) return maybeUpdateLayout(recursed + 1);
            }
        }
    }
}

const onCurrentDesktopChanged = function(oldDesktop) {
    // When moving a window across desktops, the desktop changes before the window is moved.
    // We need to set a small delay to make sure the window lands on the intended desktop.
    sleep(readConfig(CFG_CURRENT_DESKTOP_CHANGED_DELAY, CFG_CURRENT_DESKTOP_CHANGED_DELAY_DEFAULT)).then(maybeUpdateLayout);
}

const onWindowDesktopsChanged = function(client) {
    // When moving a window across desktops, the desktop changes before the window is moved.
    // We need to set a small delay to make sure the window lands on the intended desktop.
    sleep(readConfig(CFG_WINDOW_MOVED_DELAY, CFG_WINDOW_MOVED_DELAY_DEFAULT)).then(maybeUpdateLayout);
}

const onWindowClosed = function() {
    sleep(readConfig(CFG_WINDOW_CLOSED_DELAY, CFG_WINDOW_CLOSED_DELAY_DEFAULT)).then(maybeUpdateLayout);
}

const onWindowAdded = function(client) {
    sleep(readConfig(CFG_WINDOW_ADDED_DELAY, CFG_WINDOW_ADDED_DELAY_DEFAULT)).then(maybeUpdateLayout);
    client.desktopsChanged.connect(onWindowDesktopsChanged);
    client.closed.connect(onWindowClosed);
}

const registerListeners = function() {
    workspace.currentDesktopChanged.connect(onCurrentDesktopChanged);
    workspace.windowAdded.connect(onWindowAdded);
    workspace.windowList().forEach(onWindowAdded);
}

registerListeners();
