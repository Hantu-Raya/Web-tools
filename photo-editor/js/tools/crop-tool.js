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
        this.overlayRects = []; // Store overlay references
        this.aspectRatio = null; // null for free crop
        this.onComplete = null; // Callback when crop completes
        
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
        
        // Bound event handlers for proper cleanup
        this._onObjectMoving = this._onObjectMoving.bind(this);
        this._onObjectScaling = this._onObjectScaling.bind(this);
        this._onObjectModified = this._onObjectModified.bind(this);
    }
    
    /**
     * Event handler for object moving
     * @private
     */
    _onObjectMoving(e) {
        if (e.target && e.target.id === 'crop-rect') {
            this._constrainCropRect();
            this._updateOverlay();
        }
    }
    
    /**
     * Event handler for object scaling
     * @private
     */
    _onObjectScaling(e) {
        if (e.target && e.target.id === 'crop-rect') {
            this._handleCropScaling(e);
            this._updateOverlay();
        }
    }
    
    /**
     * Event handler for object modified
     * @private
     */
    _onObjectModified(e) {
        if (e.target && e.target.id === 'crop-rect') {
            this._updateOverlay();
        }
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
        
        // Remove event listeners
        this._unbindCropEvents();
        
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

        // Create crop rectangle with special properties to exclude from layers
        this.cropRect = new fabric.Rect({
            left: padding,
            top: padding,
            width: width,
            height: height,
            fill: 'rgba(255, 255, 255, 0.01)', // Near-transparent fill for better hit detection
            stroke: '#6366f1',
            strokeWidth: 3,
            strokeUniform: true, // Keep stroke width consistent at any scale
            strokeDashArray: [8, 4],
            // Control styling - Fabric.js v6 compatible
            cornerColor: '#6366f1',
            cornerStrokeColor: '#ffffff',
            cornerSize: 14,
            cornerStyle: 'circle',
            transparentCorners: false,
            borderColor: '#6366f1',
            borderScaleFactor: 2,
            // Control visibility
            hasControls: true,
            hasBorders: true,
            lockRotation: true,
            selectable: true,
            evented: true,
            // Custom properties
            id: 'crop-rect',
            excludeFromExport: true,
            isCropUI: true
        });
        
        // Disable rotation control in v6
        this.cropRect.setControlsVisibility({
            mtr: false // Hide rotation control
        });

        // First add crop rect to canvas
        this.canvas.add(this.cropRect);
        
        // Then create overlays (so they can reference the crop rect position)
        this._updateOverlay();
        
        // Bring crop rect to front and select it
        this.canvas.bringObjectToFront(this.cropRect);
        this.canvas.setActiveObject(this.cropRect);
        this.canvas.requestRenderAll();

        // Bind resize events
        this._bindCropEvents();
    }

    /**
     * Create overlay masks
     * @private
     */
    _createOverlay() {
        this._updateOverlay();
    }

    /**
     * Update overlay based on crop rect position
     * @private
     */
    _updateOverlay() {
        // Remove existing overlays
        this.overlayRects.forEach(overlay => {
            this.canvas.remove(overlay);
        });
        this.overlayRects = [];

        if (!this.cropRect) return;

        const rect = this.cropRect;
        const canvasWidth = this.canvasManager.width;
        const canvasHeight = this.canvasManager.height;
        
        // Calculate crop rect bounds - use Math.round to avoid sub-pixel gaps
        const cropLeft = Math.round(rect.left);
        const cropTop = Math.round(rect.top);
        const cropRight = Math.round(rect.left + rect.width * rect.scaleX);
        const cropBottom = Math.round(rect.top + rect.height * rect.scaleY);
        
        // Small overlap to prevent sub-pixel gaps between overlays
        const overlap = 1;

        const overlayProps = {
            fill: 'rgba(0, 0, 0, 0.6)',
            selectable: false,
            evented: false,
            excludeFromExport: true,
            isCropUI: true,
            stroke: null,
            strokeWidth: 0
        };

        // Top overlay - full width, from top to crop top (with overlap into crop area)
        if (cropTop > 0) {
            const top = new fabric.Rect({
                ...overlayProps,
                left: -overlap,
                top: -overlap,
                width: canvasWidth + overlap * 2,
                height: cropTop + overlap,
                id: 'crop-overlay-top'
            });
            this.canvas.add(top);
            this.overlayRects.push(top);
        }

        // Bottom overlay - full width, from crop bottom to canvas bottom
        if (cropBottom < canvasHeight) {
            const bottom = new fabric.Rect({
                ...overlayProps,
                left: -overlap,
                top: cropBottom,
                width: canvasWidth + overlap * 2,
                height: canvasHeight - cropBottom + overlap * 2,
                id: 'crop-overlay-bottom'
            });
            this.canvas.add(bottom);
            this.overlayRects.push(bottom);
        }

        // Left overlay - from crop top to crop bottom, left edge to crop left
        if (cropLeft > 0) {
            const left = new fabric.Rect({
                ...overlayProps,
                left: -overlap,
                top: cropTop,
                width: cropLeft + overlap,
                height: cropBottom - cropTop,
                id: 'crop-overlay-left'
            });
            this.canvas.add(left);
            this.overlayRects.push(left);
        }

        // Right overlay - from crop top to crop bottom, crop right to canvas right
        if (cropRight < canvasWidth) {
            const right = new fabric.Rect({
                ...overlayProps,
                left: cropRight,
                top: cropTop,
                width: canvasWidth - cropRight + overlap * 2,
                height: cropBottom - cropTop,
                id: 'crop-overlay-right'
            });
            this.canvas.add(right);
            this.overlayRects.push(right);
        }

        // Bring crop rect to front (v6 method)
        if (this.cropRect) {
            this.canvas.bringObjectToFront(this.cropRect);
        }
        this.canvas.requestRenderAll();
    }

    /**
     * Bind crop area events
     * @private
     */
    _bindCropEvents() {
        this.canvas.on('object:moving', this._onObjectMoving);
        this.canvas.on('object:scaling', this._onObjectScaling);
        this.canvas.on('object:modified', this._onObjectModified);
    }
    
    /**
     * Unbind crop area events
     * @private
     */
    _unbindCropEvents() {
        this.canvas.off('object:moving', this._onObjectMoving);
        this.canvas.off('object:scaling', this._onObjectScaling);
        this.canvas.off('object:modified', this._onObjectModified);
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
        // Remove overlay rects
        this.overlayRects.forEach(overlay => {
            this.canvas.remove(overlay);
        });
        this.overlayRects = [];

        // Remove crop rect
        if (this.cropRect) {
            this.canvas.remove(this.cropRect);
            this.cropRect = null;
        }
        
        this.canvas.requestRenderAll();
    }

    /**
     * Apply the crop
     */
    async applyCrop() {
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

        try {
            // Fabric.js v6: FabricImage.fromURL returns a Promise
            const img = await fabric.FabricImage.fromURL(croppedDataURL, { crossOrigin: 'anonymous' });
            
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

            this.canvas.backgroundColor = '#ffffff';
            this.canvas.add(img);
            this.canvas.requestRenderAll();
            this.canvasManager.fitToScreen();
            
            // Save the post-crop state
            this.historyManager.saveState(this.canvas, 'Crop');
        } catch (e) {
            console.error('Failed to apply crop:', e);
        }

        this.deactivate();
        
        // Call completion callback to reset toolbar
        if (typeof this.onComplete === 'function') {
            this.onComplete();
        }
    }

    /**
     * Cancel crop operation
     */
    cancelCrop() {
        this._removeCropUI();
        this.deactivate();
        
        // Call completion callback to reset toolbar
        if (typeof this.onComplete === 'function') {
            this.onComplete();
        }
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
