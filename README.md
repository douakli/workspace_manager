# Workspace Manager

Inspired by the amazing [Dynamic Workspaces](https://github.com/d86leader/dynamic_workspaces/) script.
Since I'm not reusing the code, I figured it would be appropriate to change the license to what I prefer.

A kwin script that keeps virtual desktops around the active virtual desktop in a 2D grid.

## Warning
Some features of this script require KWin patches.

Having more than one row of desktops requires KWin(Wayland) 6.5+. 
For KWin X11, the following patch is required: https://invent.kde.org/plasma/kwin/-/merge_requests/7773/diffs

For full activity overlap optimization support, the following patch is required: https://invent.kde.org/plasma/kwin/-/merge_requests/7811/diffs.
I did write a compat layer for the API to get around the kwin dev's refusal.
But turns out it doesn't work, and I keep landing on the wrong virtual desktop when switching activity.
I recommend disabling activity overlap optimization without a patched KWin.

When using a dynamic grid of Virtual Desktops, one might reach the **hard-coded limit of 20 Virtual Desktops** pretty quickly.
Adapt the following patch to your usage:
```diff
diff --git a/src/virtualdesktops.h b/src/virtualdesktops.h
index a8deb91314..a88ab8a9f5 100644
--- a/src/virtualdesktops.h
+++ b/src/virtualdesktops.h
@@ -559,7 +559,7 @@ inline const QSize &VirtualDesktopGrid::size() const
 
 inline uint VirtualDesktopManager::maximum()
 {
-    return 20;
+    return 200;
 }
 
 inline uint VirtualDesktopManager::count() const
```

Note that KWin developer never tested their code and effects with a higher virtual desktop count than 20.
Weird things might happen.
Also, from my experience, KWin gets really slow with a higher number of Virtual Desktops.

Also, since KWin 6.4+, it is possible to *move* a Virtual Desktop.
By default, this script moves the windows of desktops around in order to achieve a similar result.
I put an option in there to use desktop moving instead of windows moving, but I noticed the plasma widgets don't update accordingly.

Another thing, the slide animation will do weird things when the grid gets updated.

## How it works under the hood
The `maybeUpdateLayout` function's goal is to get to the desired state.
It does so by fixing one problem at a time, and starting over to fix anything else.

If you set a dynamic top boundary, it will check if the top row is empty.
If it is not empty, it will fix that by adding a new row at the top.

When using dynamic left or top boundary, but also when adding columns to a grid that already has multiple rows,
we add the appropriate number of desktops at the end of the list, and shift all the windows of the approriate desktops to leave empty desktops in the appropriate locations.

## Installation

On plasma 6:

``` bash
git clone https://github.com/douakli/workspace_manager.git
cd workspace_manager
kpackagetool6 --type KWin/Script --install .
```

### Upgrade

If updating, change the `kpackagetool6` command above to the following:

``` bash
# plasma 6
kpackagetool6 --type KWin/Script --upgrade .
```
