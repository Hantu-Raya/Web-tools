# Web-Tools

A collection of browser-based image editing tools. No server required - just open in browser.

> **Why I built this:** Other websites don't have the tools I need, are bloated with ads, force you to agree to terms you haven't read, and might even sell your data. These tools run 100% locally in your browser - no uploads, no tracking, no BS.

## 📋 Requirements

**Just a web browser.** That's it.

- ✅ Chrome, Firefox, Edge, or Safari
- ✅ No installation
- ✅ No Node.js, npm, or build tools
- ✅ No server or backend
- ✅ No account or login
- ✅ Works offline after first load

---

## 🔄 Image Converter (`/Img-converter`)

Batch convert images between formats.

| Feature  | Description                     |
| -------- | ------------------------------- |
| Formats  | JPEG, PNG, WebP, GIF            |
| Batch    | Convert multiple images at once |
| Preview  | Live preview before conversion  |
| Download | Individual or bulk download     |

---

## 🖼️ Quick Crop (`/crop`)

Paste-to-crop tool with live preview.

| Feature       | Description                            |
| ------------- | -------------------------------------- |
| Paste         | Ctrl+V to crop from clipboard          |
| Drag & Drop   | Drop images directly                   |
| Rotate/Flip   | 90° rotation, horizontal/vertical flip |
| Aspect Ratios | Free, 1:1, 16:9, 4:3                   |
| Live Preview  | See result before downloading          |

**Keyboard:** `R` rotate, `H` flip horizontal, `V` flip vertical

---

## 🎨 Photo Editor (`/photo-editor`)

Full-featured web photo editor using Fabric.js.

### Features

- 🖌️ Brush & eraser with adjustable size
- 🔷 Shape tools (rectangle, ellipse, line)
- ✏️ Text tool with font styling
- ✂️ Crop with aspect ratio support
- 🔄 Transform (rotate, flip, scale)
- 🎛️ Adjustments (brightness, contrast, saturation, hue)
- 🎨 Filter presets (grayscale, sepia, blur, sharpen)
- 📚 Layer management with stacking order
- ↩️ Undo/redo (50 states)
- 📁 Drag & drop anywhere
- 📋 Paste from clipboard
- 🔒 Secure file handling (magic byte validation, size limits)

### Keyboard Shortcuts

| Key      | Action                       |
| -------- | ---------------------------- |
| `V`      | Select                       |
| `M`      | Move (pan)                   |
| `B`      | Brush                        |
| `E`      | Eraser                       |
| `T`      | Text                         |
| `C`      | Crop                         |
| `I`      | Eyedropper                   |
| `U/O/L`  | Rectangle/Ellipse/Line       |
| `[/]`    | Decrease/Increase brush size |
| `Ctrl+Z` | Undo                         |
| `Ctrl+Y` | Redo                         |
| `Ctrl+S` | Quick save PNG               |
| `Escape` | Cancel operation             |
| `Enter`  | Apply crop                   |
| `Delete` | Delete selected              |

---

## 🔒 Security

All tools run 100% client-side with these protections:

- **File validation:** Magic byte checking, MIME type whitelist
- **Size limits:** 50MB max file, 25MP max image
- **Sanitization:** Filename sanitization, HTML escaping
- **No tracking:** No analytics, no cookies, no uploads

---

## 🚀 Usage

```bash
# Option 1: Open directly in browser
open index.html

# Option 2: Serve locally
npx serve .
```

---

## 📝 Recent Updates (December 2025)

- **Redesign:** Dark premium theme with Outfit font across all tools
- **Security:** Added image dimension limits, removed debug logging
- **Photo Editor:** Layer ordering buttons (bring forward/send backward)
- **Photo Editor:** Fixed text tool to not move underlying objects
- **Crop Tool:** Added "Back to Tools" navigation link

---

## 🛠️ Tech Stack

| Tool            | Libraries     |
| --------------- | ------------- |
| Image Converter | Vanilla JS    |
| Quick Crop      | Cropper.js    |
| Photo Editor    | Fabric.js 6.x |

All styling uses vanilla CSS with CSS variables for theming.
