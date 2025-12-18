# AGENTS.md - Coding Agent Guidelines

## Build & Run
- **Run**: Open `index.html` in browser, or `npx serve .`
- **Validate JS**: `node --check path/to/file.js`
- **No build step**: Vanilla HTML/CSS/JS only (no npm, no bundlers)

## JavaScript Style
- ES6 classes (PascalCase); camelCase for functions/variables
- Private methods prefixed with `_` (e.g., `_initEventListeners`)
- `const` for DOM refs/immutables; `let` for mutable state; avoid `var`
- Async/await with try-catch; optional chaining: `el?.addEventListener()`
- JSDoc comments: `@param`, `@returns`, `@private`
- Section headers: `// ===== Section Name =====`
- Fabric.js v6: Use `fabric.FabricImage`, `await obj.clone()`, `canvas.bringObjectToFront()`

## CSS Style
- BEM naming: `.block__element--modifier`
- CSS custom properties for theming; dark theme default

## HTML Style
- Semantic HTML5; IDs for JS hooks, classes for styling
- Scripts at end of `<body>`, CSS `<link>` in `<head>`
