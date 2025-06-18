const LOG_LEVEL = 1; // 0 trace, 1 debug, 2 info

function max(a, b) { return a >= b ? a : b } ;
function min(a, b) { return a <= b ? a : b } ;

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
 * Checks if the given desktops are emtpy.
 *
 * @param desktops the array of desktop to check for.
 */
const _areDesktopsEmpty = function(desktops) {
    return desktops.reduce((acc, desktop) => {return _windowsOfDesktop(desktop).length === 0 && acc}, true)
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
 *   For each i in [start,end], desktop at i+offset will have received the clients from desktop at i.
 *   Note that the desktop at from end to end+offset will receive clients.
 *
 * @param start index of the first desktop of the range
 * @param end index of the last desktop of the range
 * @param offset number of desktop to shift by
 * @param noFollow when true, do not shift the currentDesktop even if it is in the range
 */
const _shiftClientsRight = function(start, end, offset, noFollow) {
    const current = workspace.currentDesktop;
    const currIndex = workspace.desktops.indexOf(current);
    const count = workspace.desktops.length;
    const realOffset = offset === undefined ? 1 : offset;

    if (realOffset) {

        if (!noFollow) {
            if (currIndex >= start && currIndex <= end) {
                workspace.currentDesktop = workspace.desktops[currIndex + realOffset];
            }
        }

        for (let i = 0; i<realOffset; i++) {
            _shiftClientsRight(start+i, end+i, null);
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
 *   Desktops in the range of [end - offset + 1, end] will be empty.
 *   For each i in [start, end], desktop at i-offset will have received the clients from desktop at i.
 *   Note that the destops before start, up to start-offset will receive clients.
 *
 * @param start index of the first desktop of the range
 * @param end index of the last desktop of the range
 * @param offset number of desktop to shift by
 * @param noFollow when true, do not shift the currentDesktop even if it is in the range
 */
const _shiftClientsLeft = function(start, end, offset, noFollow) {
    const current = workspace.currentDesktop;
    const currIndex = workspace.desktops.indexOf(current);
    const count = workspace.desktops.length;
    const realOffset = offset === undefined ? 1 : offset;

    if (realOffset) {

        if (!noFollow) {
            if (currIndex >= start && currIndex <= end) {
                workspace.currentDesktop = workspace.desktops[currIndex - realOffset];
            }
        }

        for (let i = 0; i<realOffset; i++) {
            _shiftClientsLeft(start-i, end-i, null);
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
    const count = workspace.desktops.length;
    const rows = workspace.desktopGridHeight;
    const cols = workspace.desktopGridWidth;

    appendRow();
    _shiftClientsRight(0, count - 1, cols);
}

/**
 * Adds a new empty column of desktops at the right of the grid.
 */
const appendColumn = function() {
    const count = workspace.desktops.length;
    const rows = workspace.desktopGridHeight;
    const cols = workspace.desktopGridWidth;

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
    const count = workspace.desktops.length;
    const rows = workspace.desktopGridHeight;
    const cols = workspace.desktopGridWidth;

    _addDesktops(rows);
    for (let i = rows - 1; i >= 0; i--) {
        _shiftClientsRight(i*cols, count + rows - i);
    }
}


/**
 * If the column of given index is empty, delete it.
 *
 * @param index the index of the column to delete
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
    const isColumnEmpty = _areDesktopsEmpty(column);

    if (!isColumnEmpty) {
        return;
    }

    for (let i = columnLength - 1; i >= 0; i--) {
        _shiftClientsLeft(i*cols + index + 1, count)
    }

    _deleteDesktops(columnLength);
}

/**
 * If the row of given index is empty, delete it.
 *
 * @param index the index of the row to delete
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
    const isRowEmpty = _areDesktopsEmpty(row);

    if (!isRowEmpty) {
        return;
    }

    // The row should be empty.
    // We want to shift anything that is after the row back into it.
    _shiftClientsLeft(index*cols + rowLength, count-1, rowLength);

    _deleteDesktops(rowLength);

    if (rowLength) {
        workspace.desktopGridHeight -= 1;
    }
}

const maybeUpdateLayout = function() {
    const count = workspace.desktops.length;
    const rows = workspace.desktopGridHeight;
    const cols = workspace.desktopGridWidth;

    // Always have at least one Desktop to have a valid grid.

    if (count < 1) {
        _addDesktop();
        return maybeUpdateLayout();
    }

    // -- Up --

    const firstRow = _getRow(0);
    const isFirstRowEmpty = _areDesktopsEmpty(firstRow);

    if (!isFirstRowEmpty) {
        // Ensure there is an available row.
        prependRow();
        return maybeUpdateLayout();
    } else if (rows >= 2) {
        // Cleanup if too many rows.
        const secondRow = _getRow(1);
        const isSecondRowEmpty = _areDesktopsEmpty(secondRow);

        if (isSecondRowEmpty) {
            deleteRow(0);
            return maybeUpdateLayout();
        }
    }

    // -- Down --

    const lastRow = _getRow(rows - 1);
    const isLastRowEmpty = _areDesktopsEmpty(lastRow);

    if (!isLastRowEmpty) {
        // Ensure there is an available row.
        appendRow();
        return maybeUpdateLayout();
    } else if (rows >= 2) {
        // Cleanup if too many rows.
        const penultimateRow = _getRow(rows - 2);
        const isPenultimateRowEmpty = _areDesktopsEmpty(penultimateRow);

        if (isPenultimateRowEmpty) {
            deleteRow(rows - 1);
            return maybeUpdateLayout();
        }
    }

    // -- Left --

    const firstColumn = _getColumn(0);
    const isFirstColumnEmpty = _areDesktopsEmpty(firstColumn);

    if (!isFirstColumnEmpty) {
        // Ensure there is an available column.
        prependColumn();
        return maybeUpdateLayout();
    } else if (cols >= 2) {
        // Cleanup if too many columns.
        const secondColumn = _getColumn(1);
        const isSecondColumnEmpty = _areDesktopsEmpty(secondColumn);

        if (isSecondColumnEmpty) {
            deleteColumn(0);
            return maybeUpdateLayout();
        }
    }

    // -- Right --
    const lastColumn = _getColumn(cols - 1);
    const isLastColumnEmpty = _areDesktopsEmpty(lastColumn);

    if (!isLastColumnEmpty) {
        // Ensure there is an available column.
        appendColumn();
        return maybeUpdateLayout();
    } else if (cols >= 2) {
        // Cleanup if too many columns.
        const penultimateColumn = _getColumn(cols - 2);
        const isPenultimateColumnEmpty = _areDesktopsEmpty(penultimateColumn);

        if (isPenultimateColumnEmpty) {
            deleteColumn(cols - 1);
            return maybeUpdateLayout();
        }
    }

    console.log("Everything up to date!");
}

// prependColumn()
// appendColumn()
// deleteColumn(2)

// prependRow()
// appendRow()
// deleteRow(1)

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
