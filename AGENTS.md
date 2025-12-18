# AGENTS.md - Coding Agent Guidelines

## Build & Run
- **Run**: Open `index.html` in browser, or `npx serve .`
- **Validate JS**: `node --check script.js`
- **No build step**: Vanilla HTML/CSS/JS only

## JavaScript Style
- IIFE pattern for scripts: `(function() { 'use strict'; ... })();`
- ES6 classes with PascalCase; camelCase for functions/variables
- Private methods prefixed with `_` (e.g., `_initEventListeners`)
- `const` for DOM refs/immutables, `let` for mutable state
- JSDoc comments with `@param`/`@returns`; section headers: `// ===== Name =====`
- Async/await with try-catch; optional chaining for DOM: `el?.addEventListener()`

## CSS Style
- BEM naming: `.block__element--modifier`
- CSS custom properties for theming; mobile-first `@media (max-width: ...)`

## HTML Style
- Semantic HTML5 (`<main>`, `<header>`, `<button>`); IDs for JS, classes for CSS
- Scripts at end of `<body>`, CSS in `<head>`
