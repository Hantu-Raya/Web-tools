/**
 * =====================================================
 * PhotoLite - Shape Tool
 * Rectangle, Ellipse, and Line drawing
 * =====================================================
 */

class ShapeTool {
    constructor(canvasManager, historyManager) {
        this.canvasManager = canvasManager;
        this.historyManager = historyManager;
        this.canvas = canvasManager.canvas;
        
        this.isActive = false;
        this.currentShape = 'rectangle';
        this.isDrawing = false;
        this.startPoint = { x: 0, y: 0 };
        this.activeShape = null;
        
        // Shape properties
        this.fillColor = '#6366f1';
        this.strokeColor = '#ffffff';
        this.strokeWidth = 2;
        this.fillEnabled = true;
        this.strokeEnabled = true;

        this._initEventListeners();
    }

    /**
     * Initialize event listeners
     * @private
     */
    _initEventListeners() {
        // Color inputs
        const fillColor = document.getElementById('fill-color');
        const strokeColor = document.getElementById('stroke-color');

        fillColor?.addEventListener('input', (e) => {
            this.fillColor = e.target.value;
        });

        strokeColor?.addEventListener('input', (e) => {
            this.strokeColor = e.target.value;
        });
    }

    /**
     * Activate shape tool
     * @param {string} shape - 'rectangle', 'ellipse', or 'line'
     */
    activate(shape = 'rectangle') {
        this.isActive = true;
        this.currentShape = shape;
        this.canvas.isDrawingMode = false;
        this.canvas.selection = false;
        this.canvas.defaultCursor = 'crosshair';
        
        // CRITICAL: Skip target finding so clicks don't select objects
        this.canvas.skipTargetFind = true;
        
        // Disable all existing objects from being selectable/evented
        this.canvas.forEachObject(obj => {
            obj._originalSelectable = obj.selectable;
            obj._originalEvented = obj.evented;
            obj.selectable = false;
            obj.evented = false;
        });
        
        this.canvas.discardActiveObject();
        this.canvas.requestRenderAll();
        
        this._bindDrawingEvents();
    }

    /**
     * Deactivate shape tool
     */
    deactivate() {
        this.isActive = false;
        this.canvas.selection = true;
        this.canvas.defaultCursor = 'default';
        this.canvas.skipTargetFind = false;
        
        // Restore original selectable/evented states
        this.canvas.forEachObject(obj => {
            obj.selectable = obj._originalSelectable !== undefined ? obj._originalSelectable : true;
            obj.evented = obj._originalEvented !== undefined ? obj._originalEvented : true;
        });
        
        this.canvas.requestRenderAll();
        
        this._unbindDrawingEvents();
    }

    /**
     * Bind drawing events
     * @private
     */
    _bindDrawingEvents() {
        this._onMouseDown = this._handleMouseDown.bind(this);
        this._onMouseMove = this._handleMouseMove.bind(this);
        this._onMouseUp = this._handleMouseUp.bind(this);

        this.canvas.on('mouse:down', this._onMouseDown);
        this.canvas.on('mouse:move', this._onMouseMove);
        this.canvas.on('mouse:up', this._onMouseUp);
    }

    /**
     * Unbind drawing events
     * @private
     */
    _unbindDrawingEvents() {
        this.canvas.off('mouse:down', this._onMouseDown);
        this.canvas.off('mouse:move', this._onMouseMove);
        this.canvas.off('mouse:up', this._onMouseUp);
    }

    /**
     * Handle mouse down
     * @private
     */
    _handleMouseDown(opt) {
        if (!this.isActive) return;

        this.isDrawing = true;
        const pointer = this.canvas.getPointer(opt.e);
        this.startPoint = { x: pointer.x, y: pointer.y };

        // Create initial shape
        this.activeShape = this._createShape(pointer.x, pointer.y, 0, 0);
        this.canvas.add(this.activeShape);
    }

    /**
     * Handle mouse move
     * @private
     */
    _handleMouseMove(opt) {
        if (!this.isDrawing || !this.activeShape) return;

        const pointer = this.canvas.getPointer(opt.e);
        this._updateShape(pointer);
        this.canvas.requestRenderAll();
    }

    /**
     * Handle mouse up
     * @private
     */
    _handleMouseUp() {
        if (!this.isDrawing) return;

        this.isDrawing = false;
        
        if (this.activeShape) {
            // Set layer properties
            this.activeShape.layerId = 'layer_' + Date.now();
            this.activeShape.layerName = this._getShapeName();
            
            // Make shape selectable
            this.activeShape.set({
                selectable: true,
                evented: true
            });

            // If shape is too small, remove it
            const bounds = this.activeShape.getBoundingRect();
            if (bounds.width < 5 && bounds.height < 5) {
                this.canvas.remove(this.activeShape);
            } else {
                this.historyManager.saveState(this.canvas, `Draw ${this._getShapeName()}`);
            }

            this.activeShape = null;
        }
    }

    /**
     * Create shape based on type
     * @private
     */
    _createShape(x, y, width, height) {
        const shapeProps = {
            left: x,
            top: y,
            fill: this.fillEnabled ? this.fillColor : 'transparent',
            stroke: this.strokeEnabled ? this.strokeColor : null,
            strokeWidth: this.strokeEnabled ? this.strokeWidth : 0,
            selectable: false,
            evented: false,
            originX: 'left',
            originY: 'top'
        };

        switch (this.currentShape) {
            case 'rectangle':
                return new fabric.Rect({
                    ...shapeProps,
                    width: width,
                    height: height,
                    rx: 0,
                    ry: 0
                });

            case 'ellipse':
                return new fabric.Ellipse({
                    ...shapeProps,
                    rx: width / 2,
                    ry: height / 2,
                    originX: 'center',
                    originY: 'center'
                });

            case 'line':
                return new fabric.Line([x, y, x + width, y + height], {
                    stroke: this.strokeColor,
                    strokeWidth: this.strokeWidth,
                    selectable: false,
                    evented: false
                });

            default:
                return new fabric.Rect(shapeProps);
        }
    }

    /**
     * Update shape dimensions during draw
     * @private
     */
    _updateShape(pointer) {
        if (!this.activeShape) return;

        const width = pointer.x - this.startPoint.x;
        const height = pointer.y - this.startPoint.y;

        switch (this.currentShape) {
            case 'rectangle':
                if (width < 0) {
                    this.activeShape.set('left', pointer.x);
                }
                if (height < 0) {
                    this.activeShape.set('top', pointer.y);
                }
                this.activeShape.set({
                    width: Math.abs(width),
                    height: Math.abs(height)
                });
                break;

            case 'ellipse':
                this.activeShape.set({
                    left: this.startPoint.x + width / 2,
                    top: this.startPoint.y + height / 2,
                    rx: Math.abs(width / 2),
                    ry: Math.abs(height / 2)
                });
                break;

            case 'line':
                this.activeShape.set({
                    x2: pointer.x,
                    y2: pointer.y
                });
                break;
        }

        this.activeShape.setCoords();
    }

    /**
     * Get human-readable shape name
     * @private
     */
    _getShapeName() {
        const names = {
            'rectangle': 'Rectangle',
            'ellipse': 'Ellipse',
            'line': 'Line'
        };
        return names[this.currentShape] || 'Shape';
    }

    /**
     * Set fill color
     * @param {string} color - Hex color
     */
    setFillColor(color) {
        this.fillColor = color;
    }

    /**
     * Set stroke color
     * @param {string} color - Hex color
     */
    setStrokeColor(color) {
        this.strokeColor = color;
    }

    /**
     * Set stroke width
     * @param {number} width 
     */
    setStrokeWidth(width) {
        this.strokeWidth = Math.max(0, width);
    }

    /**
     * Enable/disable fill
     * @param {boolean} enabled 
     */
    setFillEnabled(enabled) {
        this.fillEnabled = enabled;
    }

    /**
     * Enable/disable stroke
     * @param {boolean} enabled 
     */
    setStrokeEnabled(enabled) {
        this.strokeEnabled = enabled;
    }

    /**
     * Add rectangle at position
     * @param {number} x 
     * @param {number} y 
     * @param {number} width 
     * @param {number} height 
     */
    addRectangle(x, y, width, height) {
        const rect = new fabric.Rect({
            left: x,
            top: y,
            width: width,
            height: height,
            fill: this.fillEnabled ? this.fillColor : 'transparent',
            stroke: this.strokeEnabled ? this.strokeColor : null,
            strokeWidth: this.strokeWidth,
            layerId: 'layer_' + Date.now(),
            layerName: 'Rectangle'
        });

        this.canvas.add(rect);
        this.canvas.setActiveObject(rect);
        this.canvas.requestRenderAll();
        this.historyManager.saveState(this.canvas, 'Add Rectangle');

        return rect;
    }

    /**
     * Add ellipse at position
     * @param {number} x - Center X
     * @param {number} y - Center Y
     * @param {number} rx - Radius X
     * @param {number} ry - Radius Y
     */
    addEllipse(x, y, rx, ry) {
        const ellipse = new fabric.Ellipse({
            left: x,
            top: y,
            rx: rx,
            ry: ry,
            fill: this.fillEnabled ? this.fillColor : 'transparent',
            stroke: this.strokeEnabled ? this.strokeColor : null,
            strokeWidth: this.strokeWidth,
            originX: 'center',
            originY: 'center',
            layerId: 'layer_' + Date.now(),
            layerName: 'Ellipse'
        });

        this.canvas.add(ellipse);
        this.canvas.setActiveObject(ellipse);
        this.canvas.requestRenderAll();
        this.historyManager.saveState(this.canvas, 'Add Ellipse');

        return ellipse;
    }

    /**
     * Add line
     * @param {number} x1 
     * @param {number} y1 
     * @param {number} x2 
     * @param {number} y2 
     */
    addLine(x1, y1, x2, y2) {
        const line = new fabric.Line([x1, y1, x2, y2], {
            stroke: this.strokeColor,
            strokeWidth: this.strokeWidth,
            layerId: 'layer_' + Date.now(),
            layerName: 'Line'
        });

        this.canvas.add(line);
        this.canvas.setActiveObject(line);
        this.canvas.requestRenderAll();
        this.historyManager.saveState(this.canvas, 'Add Line');

        return line;
    }

    /**
     * Get current shape settings
     * @returns {Object}
     */
    getSettings() {
        return {
            shape: this.currentShape,
            fillColor: this.fillColor,
            strokeColor: this.strokeColor,
            strokeWidth: this.strokeWidth,
            fillEnabled: this.fillEnabled,
            strokeEnabled: this.strokeEnabled
        };
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShapeTool;
}
