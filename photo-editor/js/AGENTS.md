# PHOTO EDITOR JS KNOWLEDGE

## OVERVIEW
`photo-editor/js` is the runtime core for the Fabric.js-based editor (managers, tools, filters, orchestration).

## STRUCTURE
```text
js/
|- main.js                # PhotoLiteApp orchestration and event wiring
|- canvas-manager.js      # Fabric canvas setup and core canvas operations
|- layer-manager.js       # Layer lifecycle and ordering
|- history-manager.js     # Undo/redo state stack
|- file-handler.js        # Import/export and file IO handling
|- filters/filter-engine.js
|- tools/                 # Brush/shape/text/crop/transform tool implementations
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| App bootstrap and keyboard bindings | `main.js` | Tool activation, shared listeners, app lifecycle |
| Canvas behavior and rendering | `canvas-manager.js` | Fabric interactions and viewport behavior |
| Layer ordering and active selection | `layer-manager.js` | Layer stack and UI sync |
| Undo/redo behavior | `history-manager.js` | State capture and replay |
| File import/export | `file-handler.js` | Reader/export workflows |
| Filter pipeline | `filters/filter-engine.js` | Filter application logic |
| Tool behavior | `tools/*.js` | Tool-specific state and interactions |

## CONVENTIONS
- Keep manager responsibilities separated; do not collapse them into one class.
- Tool modules should follow explicit lifecycle methods (`activate`/`deactivate`) and clean up listeners.
- Preserve script-load compatibility with existing HTML entrypoints (no bundler assumptions).
- Keep DOM event wiring centralized in `main.js` unless a manager/tool fully owns the interaction.
- Ensure history updates happen on meaningful user mutations, not every transient pointer move.

## ANTI-PATTERNS
- Do not introduce build tooling or module-import assumptions into this zero-build subtree.
- Do not bypass managers with ad-hoc direct Fabric mutations across unrelated modules.
- Do not leave lingering listeners or mode flags when switching tools.
- Do not couple tool internals to unrelated UI panels without clear app-level interfaces.

## COMMANDS
```bash
cd Web-tools
npx serve .
```

## NOTES
- Parent guidance remains in `Web-tools/AGENTS.md`; this file only covers photo-editor JS internals.
