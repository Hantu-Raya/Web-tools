# AGENTS.md - Coding Agent Guidelines

A collection of lightweight, browser-based image editing tools designed to run entirely client-side without a backend.

## 📁 Project Structure

*   **`/crop`**: A specialized image cropping tool.
    *   **Core:** `index.html`, `script.js`
    *   **Lib:** `cropper.min.js` (Cropper.js v1.6.2)
*   **`/photo-editor`**: A comprehensive photo editing application ("PhotoLite").
    *   **Core:** `index.html`, `js/main.js`
    *   **Modules:**
        *   `js/canvas-manager.js`: Fabric.js wrapper.
        *   `js/layer-manager.js`: Layer handling.
        *   `js/history-manager.js`: Undo/redo functionality.
        *   `js/tools/`: Individual tool logic (Brush, Crop, Shape, etc.).

## 🚀 Build & Run
- **Run**: Open `index.html` in browser, or `npx serve .`
- **Validate JS**: `node --check path/to/file.js`
- **No build step**: Vanilla HTML/CSS/JS only (no npm, no bundlers, no Webpack/Babel). Code must run natively in modern browsers.

## 💻 JavaScript Style
- **Modules**: ES6 classes (PascalCase); camelCase for functions/variables.
- **Encapsulation**: Private methods/properties prefixed with `_` (e.g., `_initEventListeners`).
- **Variables**: `const` for DOM refs/immutables; `let` for mutable state; avoid `var`.
- **Async**: Async/await with try-catch; optional chaining: `el?.addEventListener()`.
- **Documentation**: JSDoc comments: `@param`, `@returns`, `@private`.
- **Formatting**: Section headers: `// ===== Section Name =====`.
- **Libraries**:
    - **Fabric.js (v6)**: Used in `/photo-editor`. Use `fabric.FabricImage`, `await obj.clone()`, `canvas.bringObjectToFront()`.
    - **Cropper.js**: Used in `/crop`.

## 🎨 CSS Style
- **Methodology**: BEM naming: `.block__element--modifier`.
- **Theming**: CSS custom properties for theming; dark theme default.

## 📄 HTML Style
- **Structure**: Semantic HTML5; IDs for JS hooks, classes for styling.
- **Assets**: Scripts at end of `<body>`, CSS `<link>` in `<head>`.