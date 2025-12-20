# Web-Tools Project Context

## Project Overview
**Web-Tools** is a collection of privacy-focused, browser-based image editing utilities. The project is designed to run entirely on the client-side without any backend server or build processes. It emphasizes user privacy (no data uploads), speed, and ease of use.

## 📂 Project Structure
The project is organized into distinct directories for each tool, sharing a common landing page.

```text
/
├── index.html              # Main landing page linking to all tools
├── Img-converter/          # Image Format Converter Tool
│   ├── index.html
│   └── script.js           # Batch conversion logic
├── crop/                   # Quick Crop Tool
│   ├── index.html
│   ├── script.js           # Cropping logic
│   └── cropper.min.js      # Local dependency (Cropper.js)
└── photo-editor/           # Advanced Photo Editor (Flagship Tool)
    ├── index.html
    ├── css/                # Modular CSS (panels, toolbar, variables)
    └── js/                 # Modular ES6 Classes
        ├── main.js         # Entry point & orchestration
        ├── canvas-manager.js # Fabric.js wrapper
        ├── layer-manager.js  # Layer handling
        └── tools/          # Specific tool implementations (Brush, Shape, etc.)
```

## 🛠️ Tools & Features

### 1. Photo Editor (`/photo-editor`)
A comprehensive image editor built on **Fabric.js**.
*   **Core:** Layer management, history (undo/redo), zoom/pan.
*   **Tools:** Brush, Shapes, Text (with advanced styling), Crop, Transform.
*   **Effects:** Filters (Grayscale, Sepia, etc.), Adjustments (Brightness, Contrast, Hue).
*   **Tech:** Uses `Fabric.js v6` (via CDN). Code is structured using ES6 classes (`CanvasManager`, `Tool` subclasses) but loaded via standard `<script>` tags in dependency order.

### 2. Quick Crop (`/crop`)
A streamlined tool for cropping and basic transformations.
*   **Features:** Paste-to-crop, drag & drop, rotate, flip, aspect ratio presets.
*   **Tech:** Uses **Cropper.js** (hosted locally).

### 3. Image Converter (`/Img-converter`)
A batch image format converter.
*   **Features:** Convert between JPEG, PNG, WebP, GIF. Bulk processing.
*   **Tech:** Pure Vanilla JS (Canvas API).

## 🚀 Building & Running
Since this is a static site, no build process is required.

**Option 1: Direct File Access**
Open `index.html` directly in any modern browser.

**Option 2: Local Server (Recommended)**
Use a simple static server to avoid local file security restrictions (CORS).
```bash
npx serve .
# OR
python -m http.server
```

## 💻 Development Conventions

*   **Architecture:** Zero-dependency (dev), Vanilla JS. No bundlers (Webpack/Vite) are used.
*   **JavaScript:**
    *   Uses **ES6 Classes** for structure.
    *   **Photo Editor** uses a "Manager" pattern (`CanvasManager`, `HistoryManager`) and a "Tool" pattern for individual features.
    *   Scripts are loaded sequentially in HTML. **Order matters.**
*   **CSS:**
    *   Uses **CSS Variables** for theming.
    *   No preprocessors (Sass/Less).
    *   `photo-editor` uses split CSS files (`style.css`, `panels.css`, `toolbar.css`).
*   **External Libraries:**
    *   **Fabric.js:** Loaded via CDN in `photo-editor/index.html`.
    *   **Cropper.js:** Included locally in `crop/`.

## 🔑 Key Files for Context
*   `photo-editor/js/main.js`: The "brain" of the photo editor. Initializes managers and tools.
*   `photo-editor/js/canvas-manager.js`: Handles the Fabric.js canvas instance, zooming, and panning.
*   `photo-editor/js/layer-manager.js`: Manages the layer stack and active object selection.
*   `photo-editor/js/tools/*.js`: Individual tool logic (e.g., `brush-tool.js`).
