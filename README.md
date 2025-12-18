# Web-tools

A collection of browser-based image editing tools. No server required - just open in browser.

> **Why I built this:** Other websites don't have the tools I need, are bloated with ads, force you to agree to terms you haven't read, and might even sell your data. These tools run 100% locally in your browser - no uploads, no tracking, no BS.

## 📋 Requirements

**Just a web browser.** That's it.

- ✅ Chrome, Firefox, Edge, or Safari
- ✅ No installation
- ✅ No Node.js, npm, or build tools
- ✅ No server or backend
- ✅ No account or login
- ✅ Works offline after first load (Fabric.js cached from CDN)

---

## 🖼️ Image Cropper (`/crop`)

Paste-to-crop tool with live preview.

| File | Description |
|------|-------------|
| `index.html` | Dark mode UI with glassmorphism |
| `style.css` | Neon gradients, dark theme |
| `script.js` | Upload, crop, rotate, flip, download |
| `cropper.min.js` | Cropper.js library (v1.6.2) |

**Features:** Ctrl+V paste, drag & drop, rotate, flip, live preview, keyboard shortcuts

---

## 🎨 Photo Editor (`/photo-editor`)

Full-featured web photo editor using Fabric.js.

| File | Description |
|------|-------------|
| `index.html` | Main app shell with toolbar, panels, modals |
| `css/style.css` | Core dark theme with glassmorphism |
| `css/toolbar.css` | Left toolbar styling |
| `css/panels.css` | Right-side panels (layers, adjustments, filters) |
| `js/main.js` | App initialization, keyboard shortcuts |
| `js/canvas-manager.js` | Fabric.js wrapper, zoom/pan |
| `js/history-manager.js` | Undo/redo stack (50 states) |
| `js/layer-manager.js` | Layer list, visibility, reordering |
| `js/file-handler.js` | Import/export, drag & drop |
| `js/filters/filter-engine.js` | Brightness, contrast, saturation, presets |
| `js/tools/*.js` | Brush, shapes, text, crop, transform tools |

**Features:**
- 🖌️ Brush & eraser with adjustable size
- 🔷 Shape tools (rectangle, ellipse, line)
- ✏️ Text tool with font styling
- ✂️ Crop with aspect ratio support
- 🔄 Transform (rotate, flip, scale)
- 🎛️ Adjustments (brightness, contrast, saturation, hue)
- 🎨 Filter presets (grayscale, sepia, blur, sharpen)
- 📑 Layer management
- ↩️ Undo/redo (Ctrl+Z / Ctrl+Y)
- 📁 Drag & drop anywhere on page
- 📋 Paste from clipboard (Ctrl+V)

**Keyboard Shortcuts:**
| Key | Action |
|-----|--------|
| `V` | Select |
| `B` | Brush |
| `E` | Eraser |
| `T` | Text |
| `C` | Crop |
| `U/O/L` | Rectangle/Ellipse/Line |
| `Ctrl+Z/Y` | Undo/Redo |
| `Ctrl+S` | Quick save PNG |

---

## 🚀 Usage

```bash
# Option 1: Open directly
open crop/index.html
open photo-editor/index.html

# Option 2: Serve locally
npx serve .
```
