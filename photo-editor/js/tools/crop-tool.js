/**
 * =====================================================
 * PhotoLite - Crop Tool
 * Image cropping functionality with aspect ratio support
 * =====================================================
 */

class CropTool {
    constructor(canvasManager, historyManager) {
        this.canvasManager = canvasManager;
        this.historyManager = historyManager;
        this.canvas = canvasManager.canvas;
        
        this.isActive = false;
        this.cropRect = null;
        this.overlay = null;
        this.aspectRatio = null; // null for free crop
        
        // Predefined aspect ratios
        this.aspectRatios = {
            'free': null,
            '1:1': 1,
            '4:3': 4/3,
            '3:4': 3/4,
            '16:9': 16/9,
            '9:16': 9/16,
            '2:3': 2/3,
            '3:2': 3/2
        };
    }

    /**
     * Activate crop tool
     */
    activate() {
        this.isActive = true;
        this.canvas.isDrawingMode = false;
        this.canvas.selection = false;
        this.canvas.defaultCursor = 'crosshair';
        
        // Create crop area covering entire canvas
        this._createCropArea();
    }

    /**
     * Deactivate crop tool
     */
    deactivate() {
        this.isActive = false;
        this.canvas.selection = true;
        this.canvas.defaultCursor = 'default';
        
        this._removeCropUI();
    }

    /**
     * Create initial crop area
     * @private
     */
    _createCropArea() {
        const padding = 50;
        const width = this.canvasManager.width - padding * 2;
        const height = this.canvasManager.height - padding * 2;

        // Create crop rectangle
        this.cropRect = new fabric.Rect({
            left: padding,
            top: padding,
            width: width,
            height: height,
            fill: 'transparent',
            stroke: '#6366f1',
            strokeWidth: 2,
            strokeDashArray: [5, 5],
            cornerColor: '#6366f1',
            cornerStrokeColor: '#ffffff',
            cornerSize: 12,
            cornerStyle: 'circle',
            transparentCorners: false,
            hasRotatingPoint: false,
            lockRotation: true,
            selectable: true,
            evented: true,
            id: 'crop-rect'
        });

        // Create dark overlay outside crop area
        this._createOverlay();

        this.canvas.add(this.cropRect);
        this.canvas.setActiveObject(this.cropRect);
        this.canvas.bringToFront(this.cropRect);
        this.canvas.requestRenderAll();

        // Bind resize events
        this._bindCropEvents();
    }

    /**
     * Create overlay masks
     * @private
     */
    _createOverlay() {
        // We'll use the clipPath approach or just visual darkening
        this._updateOverlay();
    }

    /**
     * Update overlay based on crop rect position
     * @private
     */
    _updateOverlay() {
        // Remove existing overlays
        this.canvas.getObjects().forEach(obj => {
            if (obj.id && obj.id.startsWith('crop-overlay')) {
                this.canvas.remove(obj);
            }
        });

        if (!this.cropRect) return;

        const rect = this.cropRect;
        const canvasWidth = this.canvasManager.width;
        const canvasHeight = this.canvasManager.height;

        const overlayProps = {
            fill: 'rgba(0, 0, 0, 0.6)',
            selectable: false,
            evented: false,
            excludeFromExport: true
        };

        // Top overlay
        if (rect.top > 0) {
            const top = new fabric.Rect({
                ...overlayProps,
                left: 0,
                top: 0,
                width: canvasWidth,
                height: rect.top,
                id: 'crop-overlay-top'
            });
            this.canvas.add(top);
        }

        // Bottom overlay
        const bottomY = rect.top + rect.height * rect.scaleY;
        if (bottomY < canvasHeight) {
            const bottom = new fabric.Rect({
                ...overlayProps,
                left: 0,
                top: bottomY,
                width: canvasWidth,
                height: canvasHeight - bottomY,
                id: 'crop-overlay-bottom'
            });
            this.canvas.add(bottom);
        }

        // Left overlay
        if (rect.left > 0) {
            const left = new fabric.Rect({
                ...overlayProps,
                left: 0,
                top: rect.top,
                width: rect.left,
                height: rect.height * rect.scaleY,
                id: 'crop-overlay-left'
            });
            this.canvas.add(left);
        }

        // Right overlay
        const rightX = rect.left + rect.width * rect.scaleX;
        if (rightX < canvasWidth) {
            const right = new fabric.Rect({
                ...overlayProps,
                left: rightX,
                top: rect.top,
                width: canvasWidth - rightX,
                height: rect.height * rect.scaleY,
                id: 'crop-overlay-right'
            });
            this.canvas.add(right);
        }

        // Bring crop rect to front
        this.canvas.bringToFront(this.cropRect);
        this.canvas.requestRenderAll();
    }

    /**
     * Bind crop area events
     * @private
     */
    _bindCropEvents() {
        this.canvas.on('object:moving', (e) => {
            if (e.target && e.target.id === 'crop-rect') {
                this._constrainCropRect();
                this._updateOverlay();
            }
        });

        this.canvas.on('object:scaling', (e) => {
            if (e.target && e.target.id === 'crop-rect') {
                this._handleCropScaling(e);
                this._updateOverlay();
            }
        });

        this.canvas.on('object:modified', (e) => {
            if (e.target && e.target.id === 'crop-rect') {
                this._updateOverlay();
            }
        });
    }

    /**
     * Constrain crop rect within canvas bounds
     * @private
     */
    _constrainCropRect() {
        if (!this.cropRect) return;

        const rect = this.cropRect;
        const canvasWidth = this.canvasManager.width;
        const canvasHeight = this.canvasManager.height;

        // Constrain position
        if (rect.left < 0) rect.left = 0;
        if (rect.top < 0) rect.top = 0;
        
        const rightEdge = rect.left + rect.width * rect.scaleX;
        const bottomEdge = rect.top + rect.height * rect.scaleY;
        
        if (rightEdge > canvasWidth) {
            rect.left = canvasWidth - rect.width * rect.scaleX;
        }
        if (bottomEdge > canvasHeight) {
            rect.top = canvasHeight - rect.height * rect.scaleY;
        }

        rect.setCoords();
    }

    /**
     * Handle crop rect scaling with aspect ratio
     * @private
     */
    _handleCropScaling(e) {
        if (!this.cropRect) return;

        const rect = this.cropRect;
        
        // Maintain aspect ratio if set
        if (this.aspectRatio) {
            const corner = e.transform?.corner;
            if (corner) {
                const newWidth = rect.width * rect.scaleX;
                const newHeight = newWidth / this.aspectRatio;
                rect.set({
                    height: newHeight / rect.scaleY
                });
            }
        }

        // Constrain within canvas
        this._constrainCropRect();
    }

    /**
     * Remove crop UI elements
     * @private
     */
    _removeCropUI() {
        // Remove crop rect and overlays
        this.canvas.getObjects().forEach(obj => {
            if (obj.id && (obj.id === 'crop-rect' || obj.id.startsWith('crop-overlay'))) {
                this.canvas.remove(obj);
            }
        });

        this.cropRect = null;
        this.canvas.requestRenderAll();
    }

    /**
     * Apply the crop
     */
    applyCrop() {
        if (!this.cropRect) return;

        // CRITICAL: Save state BEFORE cropping so we can undo to it
        // First remove crop UI elements so they're not saved in history
        const cropRectData = {
            left: this.cropRect.left,
            top: this.cropRect.top,
            width: this.cropRect.width * this.cropRect.scaleX,
            height: this.cropRect.height * this.cropRect.scaleY
        };
        
        // Remove crop UI temporarily to save clean state
        this._removeCropUI();
        
        // Save the pre-crop state (original image)
        this.historyManager.saveState(this.canvas, 'Before Crop');

        const cropLeft = cropRectData.left;
        const cropTop = cropRectData.top;
        const cropWidth = cropRectData.width;
        const cropHeight = cropRectData.height;

        // Get cropped region as data URL
        const croppedDataURL = this.canvas.toDataURL({
            left: cropLeft,
            top: cropTop,
            width: cropWidth,
            height: cropHeight,
            format: 'png'
        });

        // Load cropped image
        fabric.Image.fromURL(croppedDataURL, (img) => {
            // Clear canvas and resize
            this.canvas.clear();
            this.canvasManager.resize(Math.round(cropWidth), Math.round(cropHeight));
            
            // Add cropped image
            img.set({
                left: 0,
                top: 0,
                layerId: 'layer_' + Date.now(),
                layerName: 'Cropped Image'
            });

            this.canvas.setBackgroundColor('#ffffff', () => {
                this.canvas.add(img);
                this.canvas.requestRenderAll();
                this.canvasManager.fitToScreen();
                
                // Save the post-crop state
                this.historyManager.saveState(this.canvas, 'Crop');
            });
        });

        this.deactivate();
    }

    /**
     * Cancel crop operation
     */
    cancelCrop() {
        this._removeCropUI();
        this.deactivate();
    }

    /**
     * Set aspect ratio
     * @param {string} ratio - 'free', '1:1', '4:3', '16:9', etc.
     */
    setAspectRatio(ratio) {
        this.aspectRatio = this.aspectRatios[ratio] || null;

        if (this.cropRect && this.aspectRatio) {
            // Adjust crop rect to match new aspect ratio
            const currentWidth = this.cropRect.width * this.cropRect.scaleX;
            const newHeight = currentWidth / this.aspectRatio;
            
            this.cropRect.set({
                height: newHeight,
                scaleY: 1
            });
            
            this._constrainCropRect();
            this._updateOverlay();
            this.canvas.requestRenderAll();
        }
    }

    /**
     * Reset crop to full canvas
     */
    resetCrop() {
        if (!this.isActive) return;

        this._removeCropUI();
        this._createCropArea();
    }

    /**
     * Set crop rect dimensions manually
     * @param {number} width 
     * @param {number} height 
     */
    setCropSize(width, height) {
        if (!this.cropRect) return;

        this.cropRect.set({
            width: width,
            height: height,
            scaleX: 1,
            scaleY: 1
        });

        // Center in canvas
        this.cropRect.set({
            left: (this.canvasManager.width - width) / 2,
            top: (this.canvasManager.height - height) / 2
        });

        this._constrainCropRect();
        this._updateOverlay();
        this.canvas.requestRenderAll();
    }

    /**
     * Get current crop dimensions
     * @returns {Object}
     */
    getCropDimensions() {
        if (!this.cropRect) return null;

        return {
            left: Math.round(this.cropRect.left),
            top: Math.round(this.cropRect.top),
            width: Math.round(this.cropRect.width * this.cropRect.scaleX),
            height: Math.round(this.cropRect.height * this.cropRect.scaleY)
        };
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CropTool;
}
