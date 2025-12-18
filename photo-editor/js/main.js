/**
 * =====================================================
 * PhotoLite - Main Application
 * Entry point and orchestration module
 * =====================================================
 */

class PhotoLiteApp {
    constructor() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    /**
     * Initialize the application
     */
    init() {
        console.log('🎨 PhotoLite initializing...');

        // Initialize core managers
        this.historyManager = new HistoryManager(50);
        this.canvasManager = new CanvasManager('main-canvas');
        this.layerManager = new LayerManager(this.canvasManager);
        this.fileHandler = new FileHandler(this.canvasManager, this.historyManager);
        this.filterEngine = new FilterEngine(this.canvasManager, this.historyManager);

        // Initialize tools
        this.brushTool = new BrushTool(this.canvasManager, this.historyManager, this.layerManager);
        this.shapeTool = new ShapeTool(this.canvasManager, this.historyManager);
        this.textTool = new TextTool(this.canvasManager, this.historyManager);
        this.cropTool = new CropTool(this.canvasManager, this.historyManager);
        this.transformTool = new TransformTool(this.canvasManager, this.historyManager);
        
        // Set up crop tool completion callback to reset toolbar
        this.cropTool.onComplete = () => {
            this.setActiveTool('select');
            document.querySelectorAll('.tool-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tool === 'select');
            });
        };

        // Current active tool
        this.activeTool = 'select';
        this.tools = {
            select: null,
            move: null,
            crop: this.cropTool,
            transform: this.transformTool,
            brush: this.brushTool,
            eraser: this.brushTool,
            eyedropper: null,
            rectangle: this.shapeTool,
            ellipse: this.shapeTool,
            line: this.shapeTool,
            text: this.textTool
        };

        // Bind UI events
        this._bindToolbarEvents();
        this._bindHeaderEvents();
        this._bindKeyboardShortcuts();
        this._bindHistoryEvents();

        // Initial canvas setup
        this._setupInitialCanvas();

        // Enforce tool constraints on new objects
        this.canvasManager.canvas.on('object:added', (e) => {
            const obj = e.target;
            if (!obj) return;

            if (this.activeTool === 'transform') {
                obj.set({
                    hasControls: true,
                    hasBorders: true,
                    lockRotation: false,
                    lockScalingX: false,
                    lockScalingY: false
                });
            } else if (this.activeTool === 'select') {
                obj.set({
                    hasControls: false,
                    hasBorders: true,
                    lockRotation: true,
                    lockScalingX: true,
                    lockScalingY: true
                });
            }
        });

        console.log('✅ PhotoLite ready!');
    }

    /**
     * Setup initial canvas state
     * @private
     */
    _setupInitialCanvas() {
        // Fit canvas to available space initially
        this.canvasManager.fitToScreen();
        
        // Show drop zone
        const dropZone = document.getElementById('drop-zone');
        if (dropZone) {
            dropZone.classList.remove('hidden');
        }
    }

    /**
     * Bind toolbar button events
     * @private
     */
    _bindToolbarEvents() {
        const toolButtons = document.querySelectorAll('.tool-btn');

        toolButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                this.setActiveTool(tool);

                // Update active button state
                toolButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    /**
     * Set active tool
     * @param {string} toolName 
     */
    setActiveTool(toolName) {
        // Deactivate previous tool
        this._deactivateCurrentTool();

        this.activeTool = toolName;

        // Update status bar
        this._updateToolStatus(toolName);

        // Activate new tool
        switch (toolName) {
            case 'select':
                this.canvasManager.setPanMode(false);
                // Ensure transform controls are disabled (selection only)
                this.transformTool.deactivate();
                this.canvasManager.canvas.selection = true;
                this.canvasManager.canvas.defaultCursor = 'default';
                break;

            case 'move':
                // Hand tool (pan)
                this.canvasManager.setPanMode(true);
                break;

            case 'crop':
                this.canvasManager.setPanMode(false);
                this.cropTool.activate();
                break;

            case 'transform':
                this.canvasManager.setPanMode(false);
                this.transformTool.activate();
                break;

            case 'brush':
                this.canvasManager.setPanMode(false);
                this.brushTool.activate();
                break;

            case 'eraser':
                this.canvasManager.setPanMode(false);
                this.brushTool.activateEraser();
                break;

            case 'eyedropper':
                this._activateEyedropper();
                break;

            case 'rectangle':
                this.shapeTool.activate('rectangle');
                break;

            case 'ellipse':
                this.shapeTool.activate('ellipse');
                break;

            case 'line':
                this.shapeTool.activate('line');
                break;

            case 'text':
                this.textTool.activate();
                break;
        }
    }

    /**
     * Deactivate current tool
     * @private
     */
    _deactivateCurrentTool() {
        const tool = this.tools[this.activeTool];
        if (tool && typeof tool.deactivate === 'function') {
            tool.deactivate();
        }
        
        // Special handling for eyedropper cleanup
        if (this.activeTool === 'eyedropper' && this._eyedropperActive) {
            const canvas = this.canvasManager.canvas;
            const preview = document.getElementById('eyedropper-preview');
            
            if (this._eyedropperMoveHandler) {
                canvas.off('mouse:move', this._eyedropperMoveHandler);
            }
            if (this._eyedropperClickHandler) {
                canvas.off('mouse:down', this._eyedropperClickHandler);
            }
            
            this._eyedropperActive = false;
            
            if (preview) {
                preview.classList.remove('visible');
            }
            
            // Restore object states
            canvas.forEachObject(obj => {
                obj.selectable = obj._eyedropperSelectable !== undefined ? obj._eyedropperSelectable : true;
                obj.evented = obj._eyedropperEvented !== undefined ? obj._eyedropperEvented : true;
            });
        }

        // Reset canvas state
        this.canvasManager.canvas.isDrawingMode = false;
        this.canvasManager.canvas.selection = true;
        this.canvasManager.canvas.defaultCursor = 'default';
        this.canvasManager.canvas.skipTargetFind = false;
    }

    /**
     * Activate eyedropper tool
     * @private
     */
    _activateEyedropper() {
        const canvas = this.canvasManager.canvas;
        canvas.defaultCursor = 'none'; // Hide cursor, we'll show custom preview
        canvas.selection = false;
        canvas.skipTargetFind = true;
        
        // Disable object interaction
        canvas.forEachObject(obj => {
            obj._eyedropperSelectable = obj.selectable;
            obj._eyedropperEvented = obj.evented;
            obj.selectable = false;
            obj.evented = false;
        });
        
        // Get the preview element
        const preview = document.getElementById('eyedropper-preview');
        const colorBox = preview?.querySelector('.eyedropper-color');
        const hexText = preview?.querySelector('.eyedropper-hex');
        
        // Store flag for eyedropper active state
        this._eyedropperActive = true;
        
        // Mouse move handler - live preview
        const moveHandler = (opt) => {
            if (!this._eyedropperActive) return;
            
            const pointer = canvas.getPointer(opt.e);
            const x = Math.floor(pointer.x);
            const y = Math.floor(pointer.y);
            
            // Get the lower canvas context for reading pixels
            const lowerCanvas = canvas.lowerCanvasEl;
            const ctx = lowerCanvas.getContext('2d');
            
            // getPointer already returns canvas coordinates
            // but we need to account for retina displays
            const retinaScaling = canvas.getRetinaScaling ? canvas.getRetinaScaling() : 1;
            const canvasX = Math.floor(x * retinaScaling);
            const canvasY = Math.floor(y * retinaScaling);
            
            // Bounds check
            if (canvasX >= 0 && canvasX < lowerCanvas.width && 
                canvasY >= 0 && canvasY < lowerCanvas.height) {
                const pixel = ctx.getImageData(canvasX, canvasY, 1, 1).data;
                const hex = this._rgbToHex(pixel[0], pixel[1], pixel[2]);
                
                // Update preview
                if (preview && colorBox && hexText) {
                    preview.classList.add('visible');
                    preview.style.left = opt.e.clientX + 'px';
                    preview.style.top = opt.e.clientY + 'px';
                    colorBox.style.backgroundColor = hex;
                    hexText.textContent = hex;
                }
            }
        };
        
        // Click handler - select color
        const clickHandler = (opt) => {
            if (!this._eyedropperActive) return;
            
            const pointer = canvas.getPointer(opt.e);
            const x = Math.floor(pointer.x);
            const y = Math.floor(pointer.y);
            
            const lowerCanvas = canvas.lowerCanvasEl;
            const ctx = lowerCanvas.getContext('2d');
            
            // getPointer already returns canvas coordinates
            // but we need to account for retina displays
            const retinaScaling = canvas.getRetinaScaling ? canvas.getRetinaScaling() : 1;
            const canvasX = Math.floor(x * retinaScaling);
            const canvasY = Math.floor(y * retinaScaling);
            
            if (canvasX >= 0 && canvasX < lowerCanvas.width && 
                canvasY >= 0 && canvasY < lowerCanvas.height) {
                const pixel = ctx.getImageData(canvasX, canvasY, 1, 1).data;
                const hex = this._rgbToHex(pixel[0], pixel[1], pixel[2]);
                
                // Set fill color
                const fillColorInput = document.getElementById('fill-color');
                if (fillColorInput) fillColorInput.value = hex;
                this.brushTool.setColor(hex);
                this.shapeTool.setFillColor(hex);
                this.textTool.setTextColor(hex);
            }
            
            // Cleanup and switch back to select tool
            this._deactivateEyedropper(canvas, moveHandler, clickHandler, preview);
        };

        canvas.on('mouse:move', moveHandler);
        canvas.on('mouse:down', clickHandler);
        
        // Store handlers for cleanup
        this._eyedropperMoveHandler = moveHandler;
        this._eyedropperClickHandler = clickHandler;
    }
    
    /**
     * Deactivate eyedropper tool
     * @private
     */
    _deactivateEyedropper(canvas, moveHandler, clickHandler, preview) {
        this._eyedropperActive = false;
        
        // Remove handlers
        canvas.off('mouse:move', moveHandler);
        canvas.off('mouse:down', clickHandler);
        
        // Hide preview
        if (preview) {
            preview.classList.remove('visible');
        }
        
        // Restore canvas state
        canvas.defaultCursor = 'default';
        canvas.selection = true;
        canvas.skipTargetFind = false;
        
        // Restore object states
        canvas.forEachObject(obj => {
            obj.selectable = obj._eyedropperSelectable !== undefined ? obj._eyedropperSelectable : true;
            obj.evented = obj._eyedropperEvented !== undefined ? obj._eyedropperEvented : true;
        });
        
        canvas.requestRenderAll();
        
        // Switch back to select tool
        this.activeTool = 'select';
        this._updateToolStatus('select');
        
        // Update toolbar
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === 'select');
        });
    }

    /**
     * Convert RGB to hex
     * @private
     */
    _rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    /**
     * Update tool status in status bar
     * @private
     */
    _updateToolStatus(toolName) {
        const toolNames = {
            'select': 'Select Tool',
            'move': 'Move Tool',
            'crop': 'Crop Tool',
            'transform': 'Transform Tool',
            'brush': 'Brush Tool',
            'eraser': 'Eraser Tool',
            'eyedropper': 'Color Picker',
            'rectangle': 'Rectangle Tool',
            'ellipse': 'Ellipse Tool',
            'line': 'Line Tool',
            'text': 'Text Tool'
        };

        const statusEl = document.getElementById('active-tool');
        if (statusEl) {
            statusEl.textContent = toolNames[toolName] || 'Select Tool';
        }
    }

    /**
     * Bind header button events
     * @private
     */
    _bindHeaderEvents() {
        // Zoom controls
        document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
            this.canvasManager.zoomIn();
        });

        document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
            this.canvasManager.zoomOut();
        });

        document.getElementById('btn-zoom-fit')?.addEventListener('click', () => {
            this.canvasManager.fitToScreen();
        });

        // Undo/Redo
        document.getElementById('btn-undo')?.addEventListener('click', () => {
            this.undo();
        });

        document.getElementById('btn-redo')?.addEventListener('click', () => {
            this.redo();
        });
    }

    /**
     * Bind keyboard shortcuts
     * @private
     */
    _bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            const key = e.key.toLowerCase();
            const ctrl = e.ctrlKey || e.metaKey;
            const shift = e.shiftKey;

            // Undo: Ctrl+Z
            if (ctrl && key === 'z' && !shift) {
                e.preventDefault();
                this.undo();
                return;
            }

            // Redo: Ctrl+Y or Ctrl+Shift+Z
            if ((ctrl && key === 'y') || (ctrl && shift && key === 'z')) {
                e.preventDefault();
                this.redo();
                return;
            }

            // Save: Ctrl+S
            if (ctrl && key === 's') {
                e.preventDefault();
                this.fileHandler.quickSave();
                return;
            }

            // Delete selected object
            if (key === 'delete' || key === 'backspace') {
                const activeObject = this.canvasManager.getActiveObject();
                if (activeObject && activeObject.type !== 'i-text') {
                    this.canvasManager.canvas.remove(activeObject);
                    this.canvasManager.render();
                    this.historyManager.saveState(this.canvasManager.canvas, 'Delete');
                }
                return;
            }

            // Tool shortcuts
            const toolShortcuts = {
                'v': 'select',
                'm': 'move',
                'c': 'crop',
                't': 'text',
                'b': 'brush',
                'e': 'eraser',
                'i': 'eyedropper',
                'u': 'rectangle',
                'o': 'ellipse',
                'l': 'line'
            };

            if (!ctrl && toolShortcuts[key]) {
                this.setActiveTool(toolShortcuts[key]);
                
                // Update toolbar UI
                document.querySelectorAll('.tool-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.tool === toolShortcuts[key]);
                });
            }

            // Escape to cancel current operation
            if (key === 'escape') {
                if (this.cropTool.isActive) {
                    this.cropTool.cancelCrop();
                }
                this.canvasManager.discardActiveObject();
                this.setActiveTool('select');
                
                // Update toolbar UI
                document.querySelectorAll('.tool-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.tool === 'select');
                });
            }

            // Enter to apply crop
            if (key === 'enter' && this.cropTool.isActive) {
                this.cropTool.applyCrop();
                // Toolbar will be reset by onComplete callback
            }

            // Bracket keys to adjust brush size
            if (key === '[') {
                this.brushTool.decreaseBrushSize();
            }
            if (key === ']') {
                this.brushTool.increaseBrushSize();
            }
        });

        // Note: Clipboard paste is handled by FileHandler to ensure proper validation
        // (MIME type, file size, and magic byte checks)
    }

    /**
     * Bind history events
     * @private
     */
    _bindHistoryEvents() {
        this.historyManager.onChange((info) => {
            const undoBtn = document.getElementById('btn-undo');
            const redoBtn = document.getElementById('btn-redo');

            if (undoBtn) {
                undoBtn.disabled = !info.canUndo;
            }
            if (redoBtn) {
                redoBtn.disabled = !info.canRedo;
            }
        });

        // Save state on object modifications
        this.canvasManager.canvas.on('object:modified', () => {
            this.historyManager.saveState(this.canvasManager.canvas, 'Modify');
        });
    }

    /**
     * Undo last action
     */
    async undo() {
        // If crop tool is active, cancel it first
        if (this.cropTool.isActive) {
            this.cropTool.cancelCrop();
            this.setActiveTool('select');
            document.querySelectorAll('.tool-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tool === 'select');
            });
        }
        await this.historyManager.undo(this.canvasManager.canvas);
    }

    /**
     * Redo last undone action
     */
    async redo() {
        // If crop tool is active, cancel it first
        if (this.cropTool.isActive) {
            this.cropTool.cancelCrop();
            this.setActiveTool('select');
            document.querySelectorAll('.tool-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tool === 'select');
            });
        }
        await this.historyManager.redo(this.canvasManager.canvas);
    }

    /**
     * Get current application state
     * @returns {Object}
     */
    getState() {
        return {
            activeTool: this.activeTool,
            canvasWidth: this.canvasManager.width,
            canvasHeight: this.canvasManager.height,
            zoom: this.canvasManager.zoom,
            layerCount: this.layerManager.getLayers().length,
            historyInfo: this.historyManager.getInfo()
        };
    }

    /**
     * Apply crop (called from crop tool confirm)
     */
    applyCrop() {
        this.cropTool.applyCrop();
    }

    /**
     * Cancel crop (called from crop tool cancel)
     */
    cancelCrop() {
        this.cropTool.cancelCrop();
    }
}

// Initialize application
const photoLite = new PhotoLiteApp();

// Note: Global exposure removed for security
// Use browser DevTools to inspect application state if needed for debugging
