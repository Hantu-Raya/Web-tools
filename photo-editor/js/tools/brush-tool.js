/**
 * =====================================================
 * PhotoLite - Brush Tool
 * Freehand drawing with layer-aware eraser
 * Uses fabric.Group for drawing layer isolation
 * =====================================================
 */

class BrushTool {
    constructor(canvasManager, historyManager, layerManager = null) {
        this.canvasManager = canvasManager;
        this.historyManager = historyManager;
        this.layerManager = layerManager;
        this.canvas = canvasManager.canvas;
        
        this.isActive = false;
        this.isEraser = false;
        this.brushSize = 10;
        this.brushColor = '#6366f1';
        this.brushOpacity = 1;
        
        // Drawing layer (fabric.Group) for isolating brush strokes
        this.drawingLayer = null;
        
        // Brush types
        this.brushTypes = {
            pencil: 'PencilBrush',
            circle: 'CircleBrush',
            spray: 'SprayBrush'
        };
        this.currentBrushType = 'pencil';

        this._initEventListeners();
    }

    /**
     * Set layer manager reference
     * @param {LayerManager} layerManager 
     */
    setLayerManager(layerManager) {
        this.layerManager = layerManager;
    }

    /**
     * Initialize event listeners
     * @private
     */
    _initEventListeners() {
        // Brush size slider
        const sizeSlider = document.getElementById('brush-size');
        const sizeValue = document.getElementById('brush-size-value');
        
        sizeSlider?.addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            if (sizeValue) sizeValue.textContent = this.brushSize;
            this._updateBrush();
        });

        // Fill color (used as brush color)
        const fillColor = document.getElementById('fill-color');
        fillColor?.addEventListener('input', (e) => {
            this.brushColor = e.target.value;
            this._updateBrush();
        });

        // Canvas drawing events - use 'before:path:created' to intercept before the path is added
        this.canvas.on('path:created', (e) => {
            if (this.isActive) {
                // Defer processing to next frame to avoid interfering with Fabric's brush state
                requestAnimationFrame(() => {
                    this._handlePathCreated(e.path);
                });
            }
        });

        // Ensure brush properly ends on mouse up
        this.canvas.on('mouse:up', () => {
            if (this.isActive && this.canvas.isDrawingMode) {
                // Reset the freeDrawingBrush state to prevent continuous drawing
                const brush = this.canvas.freeDrawingBrush;
                if (brush && brush._reset) {
                    brush._reset();
                }
            }
        });
    }

    /**
     * Handle path created event - add to drawing layer with proper compositing
     * @private
     * @param {fabric.Path} path - The created path
     */
    async _handlePathCreated(path) {
        // Check if path is still valid and on canvas
        if (!path || !this.canvas.getObjects().includes(path)) {
            return;
        }

        // Remove path from main canvas (it was added automatically)
        this.canvas.remove(path);

        if (this.isEraser) {
            // ERASER: Apply to BOTH drawing layer AND base image
            await this._applyDualEraser(path);
        } else {
            // BRUSH: Normal drawing - add to drawing layer
            this._ensureDrawingLayer();
            
            path.set({
                globalCompositeOperation: 'source-over',
                selectable: false,
                evented: false
            });

            // Add path to the drawing layer group
            this.drawingLayer.add(path);
            
            // Force re-render of the group's cache
            this.drawingLayer.dirty = true;
            this.drawingLayer.setCoords();
            this.canvas.requestRenderAll();

            // Save history
            this.historyManager.saveState(this.canvas, 'Draw');

            // Update layer manager
            if (this.layerManager) {
                this.layerManager.refresh();
            }
        }
    }

    /**
     * Apply eraser to both drawing layer and base image
     * @private
     * @param {fabric.Path} eraserPath - The eraser stroke path
     */
    async _applyDualEraser(eraserPath) {
        // 1. Apply to drawing layer (if it exists and has content)
        this._ensureDrawingLayer();
        
        // Only erase from drawing layer if it's not locked
        if (this.drawingLayer && !this.drawingLayer.isLocked && this.drawingLayer.getObjects().length > 0) {
            // Clone the path for the drawing layer
            const drawingEraserPath = await eraserPath.clone();
            drawingEraserPath.set({
                globalCompositeOperation: 'destination-out',
                stroke: 'rgba(255,255,255,1)',
                selectable: false,
                evented: false
            });
            
            this.drawingLayer.add(drawingEraserPath);
            this.drawingLayer.dirty = true;
            this.drawingLayer.setCoords();
        }

        // 2. Apply to base image(s) using pixel compositing
        await this._applyEraserToImages(eraserPath);

        // 3. Set canvas background to transparent so erased areas show transparency
        this.canvas.backgroundColor = null;
        
        this.canvas.requestRenderAll();

        // Save history
        this.historyManager.saveState(this.canvas, 'Erase');

        // Update layer manager
        if (this.layerManager) {
            this.layerManager.refresh();
        }
    }

    /**
     * Apply eraser to all image objects (base layers)
     * @private
     * @param {fabric.Path} eraserPath - The eraser stroke path
     */
    async _applyEraserToImages(eraserPath) {
        // Find all image objects (excluding the drawing layer)
        // AND exclude locked objects
        const images = this.canvas.getObjects().filter(obj => 
            obj.type === 'image' && 
            obj.layerId !== 'drawing-layer' &&
            !obj.isLocked
        );

        if (images.length === 0) return;

        const width = this.canvas.width;
        const height = this.canvas.height;

        // Process each image
        for (const imageObj of images) {
            try {
                // Create temp canvas for this image
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = width;
                tempCanvas.height = height;
                const ctx = tempCanvas.getContext('2d');

                // Create static canvas to render the image
                const tempFabric = new fabric.StaticCanvas(null, {
                    width: width,
                    height: height,
                    backgroundColor: null
                });

                // Clone and render the image
                const clonedImg = await imageObj.clone();
                tempFabric.add(clonedImg);
                tempFabric.renderAll();

                // Draw image to native canvas
                const fabricEl = tempFabric.lowerCanvasEl || tempFabric.getElement();
                ctx.drawImage(fabricEl, 0, 0);

                // Apply eraser with destination-out
                ctx.globalCompositeOperation = 'destination-out';

                // Create temp canvas for eraser path
                const eraserFabric = new fabric.StaticCanvas(null, {
                    width: width,
                    height: height,
                    backgroundColor: null
                });

                const clonedEraser = await eraserPath.clone();
                clonedEraser.set({
                    stroke: 'white',
                    fill: null,
                    strokeWidth: eraserPath.strokeWidth
                });
                eraserFabric.add(clonedEraser);
                eraserFabric.renderAll();

                const eraserEl = eraserFabric.lowerCanvasEl || eraserFabric.getElement();
                ctx.drawImage(eraserEl, 0, 0);
                ctx.globalCompositeOperation = 'source-over';

                // Create new image from result
                // Optimization: Use canvas directly to avoid expensive PNG encoding/decoding
                const newImg = new fabric.FabricImage(tempCanvas);

                // Position at origin (transforms already baked in)
                newImg.set({
                    left: 0,
                    top: 0,
                    originX: 'left',
                    originY: 'top',
                    scaleX: 1,
                    scaleY: 1,
                    angle: 0,
                    layerId: imageObj.layerId || 'layer_' + Date.now(),
                    layerName: imageObj.layerName || 'Image',
                    selectable: true,
                    evented: true
                });

                // Get z-index of original image
                const index = this.canvas.getObjects().indexOf(imageObj);

                // Remove original, add new at same position
                this.canvas.remove(imageObj);
                if (index >= 0) {
                    this.canvas.insertAt(index, newImg);
                } else {
                    this.canvas.add(newImg);
                }

                // Cleanup
                tempFabric.dispose();
                eraserFabric.dispose();

            } catch (e) {
                console.error('Failed to erase from image:', e);
            }
        }

        // Make sure drawing layer stays on top
        if (this.drawingLayer) {
            this.canvas.bringObjectToFront(this.drawingLayer);
        }
    }

    /**
     * Ensure the drawing layer group exists
     * @private
     */
    _ensureDrawingLayer() {
        // Check if drawing layer already exists on canvas
        const existingLayer = this.canvas.getObjects().find(obj => 
            obj.layerId === 'drawing-layer' && obj.type === 'group'
        );

        if (existingLayer) {
            this.drawingLayer = existingLayer;
            return;
        }

        // Create new drawing layer group
        this.drawingLayer = new fabric.Group([], {
            left: 0,
            top: 0,
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
            objectCaching: true,  // CRITICAL: Enables isolation for destination-out
            subTargetCheck: false,
            interactive: false,
            layerId: 'drawing-layer',
            layerName: 'Drawing'
        });

        // Add to canvas (on top)
        this.canvas.add(this.drawingLayer);
    }

    /**
     * Get the drawing layer group
     * @returns {fabric.Group|null}
     */
    getDrawingLayer() {
        return this.drawingLayer;
    }

    /**
     * Clear the drawing layer
     */
    clearDrawingLayer() {
        if (this.drawingLayer) {
            // Remove all objects from the group
            const objects = this.drawingLayer.getObjects().slice();
            objects.forEach(obj => this.drawingLayer.remove(obj));
            this.drawingLayer.dirty = true;
            this.canvas.requestRenderAll();
        }
    }

    /**
     * Flatten drawing layer to image (optimization for many strokes)
     */
    async flattenDrawingLayer() {
        if (!this.drawingLayer || this.drawingLayer.getObjects().length === 0) {
            return;
        }

        // Optimization: Convert to canvas element directly to avoid PNG encoding/decoding
        const element = this.drawingLayer.toCanvasElement({
            multiplier: 1
        });

        // Create image from the canvas element
        const img = new fabric.FabricImage(element);
        
        img.set({
            left: this.drawingLayer.left,
            top: this.drawingLayer.top,
            originX: 'left',
            originY: 'top',
            layerId: 'drawing-flattened',
            layerName: 'Drawing (Flattened)',
            selectable: true,
            evented: true
        });

        // Get z-index of drawing layer
        const index = this.canvas.getObjects().indexOf(this.drawingLayer);

        // Remove drawing layer
        this.canvas.remove(this.drawingLayer);
        this.drawingLayer = null;

        // Add flattened image at same position
        if (index >= 0) {
            this.canvas.insertAt(index, img);
        } else {
            this.canvas.add(img);
        }

        this.canvas.requestRenderAll();
        this.historyManager.saveState(this.canvas, 'Flatten Drawing');
    }

    /**
     * Activate brush tool
     */
    activate() {
        this.isActive = true;
        this.isEraser = false;
        this.canvas.isDrawingMode = true;
        this._updateBrush();
        this._showBrushOptions();
    }

    /**
     * Activate eraser tool
     */
    activateEraser() {
        this.isActive = true;
        this.isEraser = true;
        this.canvas.isDrawingMode = true;
        
        this._updateBrush();
        this._showBrushOptions();
    }

    /**
     * Deactivate brush/eraser
     */
    deactivate() {
        this.isActive = false;
        this.canvas.isDrawingMode = false;
        this._hideBrushOptions();
    }

    /**
     * Update brush properties
     * @private
     */
    _updateBrush() {
        const brush = this.canvas.freeDrawingBrush;
        if (!brush) {
            this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
        }

        const currentBrush = this.canvas.freeDrawingBrush;
        currentBrush.width = this.brushSize;
        
        if (this.isEraser) {
            // Eraser: use semi-transparent pink to show where you're erasing
            // The actual erasing happens via globalCompositeOperation in _handlePathCreated
            currentBrush.color = 'rgba(255, 100, 100, 0.5)';
            currentBrush.shadow = null;
        } else {
            currentBrush.color = this._hexToRgba(this.brushColor, this.brushOpacity);
            // Shadow for softer brush effect
            currentBrush.shadow = new fabric.Shadow({
                blur: this.brushSize / 4,
                offsetX: 0,
                offsetY: 0,
                color: currentBrush.color
            });
        }
    }

    /**
     * Convert hex to rgba
     * @private
     */
    _hexToRgba(hex, alpha = 1) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
        }
        // Return safe default for invalid hex colors
        return `rgba(0, 0, 0, ${alpha})`;
    }

    /**
     * Show brush options panel
     * @private
     */
    _showBrushOptions() {
        const options = document.getElementById('brush-options');
        if (options) {
            options.style.display = 'flex';
        }
    }

    /**
     * Hide brush options panel
     * @private
     */
    _hideBrushOptions() {
        const options = document.getElementById('brush-options');
        if (options) {
            options.style.display = 'none';
        }
    }

    /**
     * Set brush size
     * @param {number} size 
     */
    setSize(size) {
        this.brushSize = Math.max(1, Math.min(100, size));
        
        const sizeSlider = document.getElementById('brush-size');
        const sizeValue = document.getElementById('brush-size-value');
        
        if (sizeSlider) sizeSlider.value = this.brushSize;
        if (sizeValue) sizeValue.textContent = this.brushSize;
        
        this._updateBrush();
    }

    /**
     * Set brush color
     * @param {string} color - Hex color
     */
    setColor(color) {
        this.brushColor = color;
        
        const fillColor = document.getElementById('fill-color');
        if (fillColor) fillColor.value = color;
        
        this._updateBrush();
    }

    /**
     * Set brush opacity
     * @param {number} opacity - 0 to 1
     */
    setOpacity(opacity) {
        this.brushOpacity = Math.max(0, Math.min(1, opacity));
        this._updateBrush();
    }

    /**
     * Set brush type
     * @param {string} type - 'pencil', 'circle', or 'spray'
     */
    setBrushType(type) {
        if (!this.brushTypes[type]) return;
        
        this.currentBrushType = type;
        
        switch (type) {
            case 'pencil':
                this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
                break;
            case 'circle':
                this.canvas.freeDrawingBrush = new fabric.CircleBrush(this.canvas);
                break;
            case 'spray':
                this.canvas.freeDrawingBrush = new fabric.SprayBrush(this.canvas);
                break;
        }
        
        this._updateBrush();
    }

    /**
     * Increase brush size
     */
    increaseBrushSize() {
        this.setSize(this.brushSize + 5);
    }

    /**
     * Decrease brush size
     */
    decreaseBrushSize() {
        this.setSize(this.brushSize - 5);
    }

    /**
     * Get current brush settings
     * @returns {Object}
     */
    getSettings() {
        return {
            size: this.brushSize,
            color: this.brushColor,
            opacity: this.brushOpacity,
            type: this.currentBrushType,
            isEraser: this.isEraser
        };
    }

    /**
     * Apply settings
     * @param {Object} settings 
     */
    applySettings(settings) {
        if (settings.size !== undefined) this.brushSize = settings.size;
        if (settings.color !== undefined) this.brushColor = settings.color;
        if (settings.opacity !== undefined) this.brushOpacity = settings.opacity;
        if (settings.type !== undefined) this.currentBrushType = settings.type;
        
        this._updateBrush();
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BrushTool;
}
