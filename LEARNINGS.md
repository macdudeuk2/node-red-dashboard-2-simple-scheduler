# Learnings: Dashboard 2.0 Widget Development

## The Problem We Had

After renaming the package from `node-red-dashboard-2-ui-scheduler` to `node-red-dashboard-2-simple-scheduler`, the widget:
- ✅ Worked locally (installed via `file:` symlink)
- ❌ Failed on production (installed from GitHub)
- Error: 404 on `/resources/node-red-dashboard-2-simple-scheduler/ui-scheduler.umd.js`

## Root Cause

**Dashboard 2.0 v1.29 requires widget files to be in a `resources/` subdirectory.**

The issue was NOT the package rename - it was that we had:
1. The `resources/` directory in `.gitignore`
2. Widget file at package root instead of `resources/`
3. GitHub installs only get committed files (not build outputs)

## What We Should Have Done FIRST

### 1. **Consulted Dashboard 2.0 Documentation**
- Check official widget development guide
- Look at example third-party widgets
- Understand file structure requirements for different Dashboard versions

### 2. **Compared Working vs Broken Setup**
- Extract old working tarball immediately
- Compare `package.json` structure
- Check file locations
- **This would have revealed the issue in 5 minutes**

### 3. **Understood Install Methods**
- **Local (`file:`)**: Symlinks to source directory with build outputs
- **Tarball**: Includes files from `files` array (can include build outputs)
- **GitHub**: Only gets committed files (excludes `.gitignore` entries)

## Dashboard 2.0 Widget Package Requirements

### Required package.json Structure

```json
{
  "name": "node-red-dashboard-2-{your-widget-name}",
  "exports": {
    "import": "./resources/{your-widget}.umd.js",
    "require": "./resources/{your-widget}.umd.js"
  },
  "files": [
    "nodes/*",
    "ui/*",
    "resources/*"
  ],
  "node-red": {
    "nodes": {
      "your-widget": "nodes/your-widget.js"
    }
  },
  "node-red-dashboard-2": {
    "widgets": {
      "your-widget": {
        "output": "{your-widget}.umd.js",
        "component": "YourWidgetComponent"
      }
    }
  }
}
```

### Required File Structure

```
your-package/
├── package.json
├── nodes/
│   ├── your-widget.js          (Node-RED backend)
│   └── your-widget.html         (Node-RED config UI)
├── ui/
│   ├── components/
│   │   └── YourWidget.vue       (Dashboard widget UI)
│   └── index.js                 (Export widget)
└── resources/
    └── your-widget.umd.js       ⚠️ MUST BE HERE AND COMMITTED
```

### Critical Points

1. **Widget file MUST be in `resources/` subdirectory**
   - Dashboard 2.0 v1.29 expects it there
   - URL pattern: `/resources/{package-name}/{output}`
   - Resolved path: `node_modules/{package-name}/resources/{output}`

2. **`exports` field MUST point to `resources/` location**
   ```json
   "exports": {
     "import": "./resources/ui-scheduler.umd.js",
     "require": "./resources/ui-scheduler.umd.js"
   }
   ```

3. **Built files must be committed to git for GitHub installs**
   - Don't `.gitignore` the `resources/` directory
   - Or use a different build process that generates committed files

4. **Package name must start with `node-red-dashboard-2-`**
   - Required for Dashboard 2.0's widget discovery
   - Pattern: `node-red-dashboard-2-*`

## Build Configuration

### Vite config should output to `resources/`

```javascript
// vite.config.mjs
export default defineConfig({
  build: {
    lib: {
      entry: './ui/index.js',
      name: 'ui-scheduler',
      fileName: (format) => `ui-scheduler.${format}.js`,
      formats: ['umd']
    },
    outDir: './resources',  // ⚠️ Output to resources/
    emptyOutDir: true
  }
})
```

## .gitignore Considerations

For Dashboard 2.0 widgets, **DO NOT** ignore the build output:

```gitignore
# Node modules
node_modules/

# ⚠️ DO NOT ignore resources/ or built files
# Dashboard 2.0 needs these for GitHub installs

# OS files
.DS_Store
```

## Testing Strategy

### Test Both Install Methods

1. **Local development**: `"your-package": "file:../path/to/source"`
   - Fast iteration
   - Sees all files including build outputs

2. **GitHub install**: `"your-package": "github:user/repo"`
   - Test what production will get
   - Only sees committed files
   - **Test this BEFORE deploying to production**

### Quick Test After Changes

```bash
# On test machine (not production):
cd ~/.node-red
npm uninstall your-package
npm install github:youruser/your-repo
rm .config.nodes.json
# Restart Node-RED and test
```

## Version Differences

### Dashboard 2.0 v1.12 vs v1.29
- v1.29 is stricter about file locations
- v1.29 requires `resources/` subdirectory
- Always test against the version used in production

## Troubleshooting Checklist

If a widget works locally but not on production:

- [ ] Check Dashboard 2.0 versions match (or test with production version)
- [ ] Check install method (file: vs github: vs tarball)
- [ ] Verify `exports` field points to correct location
- [ ] Verify file actually exists at that location in `node_modules/`
- [ ] Check file is committed to git (`git ls-files | grep filename`)
- [ ] Clear Node-RED cache (`.config.nodes.json`)
- [ ] Check browser Network tab for exact 404 URL
- [ ] Compare to a working widget's structure

## Z-Index and Stacking Context Issue

### The Problem

When a widget displays a modal/dialog, it can appear **below** other ui-groups that are rendered later in the Dashboard 2.0 page DOM, even with very high z-index values (e.g., 999999).

**Why:**
- Each Dashboard 2.0 ui-group creates its own stacking context
- DOM order matters: later elements appear on top within the same stacking level
- A dialog inside a widget is trapped in that widget's stacking context
- Z-index only works within the same stacking context

### The Solution: Vue 3 Teleport

Use Vue 3's `<Teleport>` component to move the dialog to the document body level:

```vue
<template>
  <div class="my-widget">
    <!-- Widget content -->
    
    <!-- Dialog teleported to body -->
    <Teleport to="body">
      <div v-if="showDialog" class="dialog-overlay">
        <div class="dialog-content">
          <!-- Dialog content -->
        </div>
      </div>
    </Teleport>
  </div>
</template>
```

**What this does:**
- Moves the dialog DOM element to `<body>`, outside all Dashboard containers
- Escapes the widget's stacking context entirely
- Dialog now appears above ALL ui-groups regardless of DOM order
- Z-index now works as expected at the top level

**CSS for the dialog:**
```css
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999999;  /* High value to ensure it's on top */
}
```

## Updating Production Server

### Clean Update Process

When you push changes to GitHub and need to update the production server:

```bash
# SSH into production server
ssh your-server

# Stop Node-RED (if using systemctl)
sudo systemctl stop nodered

# OR if running as a service under your user
# (find the process and kill it, or use pm2 stop, etc.)

# Go to Node-RED directory
cd ~/.node-red

# Uninstall the old version
npm uninstall node-red-dashboard-2-simple-scheduler

# Install latest from GitHub
npm install github:macdudeuk2/node-red-dashboard-2-simple-scheduler

# Clear Node-RED cache
rm .config.nodes.json

# Restart Node-RED
sudo systemctl start nodered

# OR restart your service however you normally do
```

### Quick Update (if Node-RED can handle restarts)

```bash
cd ~/.node-red
npm uninstall node-red-dashboard-2-simple-scheduler && \
npm install github:macdudeuk2/node-red-dashboard-2-simple-scheduler && \
rm .config.nodes.json
# Restart Node-RED through your normal method
```

### Verification

1. Check Node-RED logs for errors: `sudo journalctl -u nodered -f`
2. Open Dashboard in browser and hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)
3. Check browser console for any errors
4. Test widget functionality

### Common Issues After Update

**404 on widget file:**
- Clear browser cache (hard refresh)
- Verify file exists: `ls -la ~/.node-red/node_modules/node-red-dashboard-2-simple-scheduler/resources/ui-scheduler.umd.js`
- Check Node-RED logs for module loading errors

**Widget not appearing:**
- Delete `.config.nodes.json` and restart Node-RED
- Check Node-RED logs for registration errors

**Old version still showing:**
- Browser cache: Hard refresh or clear cache
- Node-RED cache: Delete `.config.nodes.json` and restart

## Key Lessons

1. **RTFM first** - Check documentation before trial and error
2. **Compare working examples** - Use existing widgets as reference
3. **Understand the tools** - Know how npm, git, and Dashboard 2.0 interact
4. **Test install methods** - Don't assume GitHub install works like local
5. **Version differences matter** - Always test against production versions
6. **Built outputs may need committing** - For widgets, build outputs aren't always gitignored
7. **Use Teleport for modals** - Escape stacking context issues in Dashboard 2.0 widgets
8. **Test production updates** - Always have a rollback plan

## Resources

- Node-RED Dashboard 2.0 Documentation: https://dashboard.flowfuse.com/
- Example widgets: `@flowfuse/node-red-dashboard-2-ui-*` packages
- Node-RED widget development: https://nodered.org/docs/creating-nodes/

## Time Wasted vs Time Saved

- Time spent troubleshooting: ~2 hours
- Time if we'd checked docs first: ~10 minutes
- **Ratio: 12:1** 😞

**Lesson: Always start with documentation and working examples.**


