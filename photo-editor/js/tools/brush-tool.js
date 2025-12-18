/**
 * =====================================================
 * PhotoLite - Brush Tool
 * Freehand drawing and true transparency eraser
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

        // Canvas drawing events
        this.canvas.on('path:created', (e) => {
            if (this.isActive) {
                const path = e.path;
                
                if (this.isEraser) {
                    // TRUE ERASER: Apply pixel-level erasing
                    this._applyPixelEraser(path);
                } else {
                    // Normal brush stroke
                    path.layerId = 'layer_' + Date.now();
                    path.layerName = 'Brush Stroke';
                    this.historyManager.saveState(this.canvas, 'Draw');
                }
            }
        });
    }

    /**
     * Apply pixel-level eraser using canvas compositing
     * This creates true transparency by erasing pixels
     * @private
     * @param {fabric.Path} eraserPath - The eraser stroke path
     */
    _applyPixelEraser(eraserPath) {
        // Remove the eraser path from canvas (we'll apply it via compositing)
        this.canvas.remove(eraserPath);

        // Get canvas dimensions
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Create temp canvas to render current state (without background)
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const ctx = tempCanvas.getContext('2d');

        // Render all objects to temp canvas (preserve transparency)
        const currentBg = this.canvas.backgroundColor;
        this.canvas.backgroundColor = null;
        
        // Use fabric's renderAll to get the current state
        const dataURL = this.canvas.toDataURL({
            format: 'png',
            multiplier: 1
        });

        // Restore background
        this.canvas.backgroundColor = currentBg;

        // Load the rendered image
        const img = new Image();
        img.onload = () => {
            // Draw the current canvas state
            ctx.drawImage(img, 0, 0);

            // Now draw the eraser path with destination-out
            ctx.globalCompositeOperation = 'destination-out';
            
            // Create a temporary fabric canvas to render just the eraser path
            const eraserCanvas = document.createElement('canvas');
            eraserCanvas.width = width;
            eraserCanvas.height = height;
            const eraserCtx = eraserCanvas.getContext('2d');
            
            // Render the eraser path
            const tempFabric = new fabric.StaticCanvas(null, {
                width: width,
                height: height,
                backgroundColor: null
            });
            
            // Clone the path with solid fill for erasing
            eraserPath.clone((clonedPath) => {
                clonedPath.set({
                    stroke: 'white',
                    fill: null,
                    strokeWidth: eraserPath.strokeWidth
                });
                tempFabric.add(clonedPath);
                tempFabric.renderAll();

                // Draw the eraser stroke with destination-out
                ctx.drawImage(tempFabric.lowerCanvasEl, 0, 0);
                ctx.globalCompositeOperation = 'source-over';

                // Now create a new fabric image from the erased result
                const resultDataURL = tempCanvas.toDataURL('image/png');
                
                fabric.Image.fromURL(resultDataURL, (newImg) => {
                    // Clear canvas and add the erased image
                    const lockedObjects = this.canvas.getObjects().filter(obj => obj.isLocked === true);
                    
                    // Clear all non-locked objects
                    this.canvas.getObjects().slice().forEach(obj => {
                        if (obj.isLocked !== true) {
                            this.canvas.remove(obj);
                        }
                    });

                    // Set transparent background
                    this.canvas.backgroundColor = null;

                    // Add the erased image as the base layer
                    newImg.set({
                        left: 0,
                        top: 0,
                        originX: 'left',
                        originY: 'top',
                        layerId: 'erased_' + Date.now(),
                        layerName: 'Canvas',
                        selectable: true,
                        evented: true
                    });

                    // Insert at bottom (index 0)
                    this.canvas.insertAt(newImg, 0);
                    this.canvas.requestRenderAll();

                    // Cleanup
                    tempFabric.dispose();

                    // Save history
                    this.historyManager.saveState(this.canvas, 'Erase');
                }, { crossOrigin: 'anonymous' });
            });
        };
        img.src = dataURL;
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
            // The actual erasing happens via pixel compositing
            currentBrush.color = 'rgba(255, 150, 150, 0.5)';
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
        return hex;
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
