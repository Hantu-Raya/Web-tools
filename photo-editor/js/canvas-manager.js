/**
 * =====================================================
 * PhotoLite - Canvas Manager
 * Fabric.js canvas wrapper with zoom, pan, and utilities
 * =====================================================
 */

class CanvasManager {
    constructor(canvasId, options = {}) {
        this.canvasElement = document.getElementById(canvasId);
        this.wrapper = document.getElementById('canvas-wrapper');
        this.canvasArea = document.getElementById('canvas-area');
        
        // Default canvas dimensions
        this.width = options.width || 1200;
        this.height = options.height || 800;
        
        // Zoom settings
        this.zoom = 1;
        this.minZoom = 0.1;
        this.maxZoom = 10;
        this.zoomStep = 0.1;
        
        // Pan settings
        this.isPanning = false;
        this.isPanMode = false; // Explicit pan mode (Hand tool)
        this.lastPanPosition = { x: 0, y: 0 };
        
        // Initialize Fabric canvas
        this.canvas = new fabric.Canvas(canvasId, {
            width: this.width,
            height: this.height,
            backgroundColor: '#ffffff',
            preserveObjectStacking: true,
            selection: true,
            renderOnAddRemove: false // Performance: Manual render control
        });

        // Store original dimensions
        this.originalWidth = this.width;
        this.originalHeight = this.height;
        
        // Performance: Batched rendering flag
        this._renderScheduled = false;

        this._initEventListeners();
        this._updateWrapperSize();
        
        // Listen for history restoration events
        window.addEventListener('canvas:restored', (e) => {
            if (e.detail && e.detail.width && e.detail.height) {
                this.width = e.detail.width;
                this.height = e.detail.height;
                this._updateWrapperSize();
                this._updateDimensionsDisplay();
                this.fitToScreen();
            }
        });
    }

    /**
     * Performance: Schedule a batched render using requestAnimationFrame
     * Prevents multiple render calls in the same frame
     */
    scheduleRender() {
        if (this._renderScheduled) return;
        this._renderScheduled = true;
        requestAnimationFrame(() => {
            this._renderScheduled = false;
            this.canvas.requestRenderAll();
        });
    }

    /**
     * Initialize canvas event listeners
     * @private
     */
    _initEventListeners() {
        // Mouse wheel zoom
        this.canvasArea.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -this.zoomStep : this.zoomStep;
                this.setZoom(this.zoom + delta, { x: e.offsetX, y: e.offsetY });
            }
        }, { passive: false });

        // Pan with middle mouse button or space + drag OR if in Pan Mode
        this.canvas.on('mouse:down', (opt) => {
            if (this.isPanMode || opt.e.button === 1 || (opt.e.altKey && opt.e.button === 0)) {
                this.isPanning = true;
                this.lastPanPosition = { x: opt.e.clientX, y: opt.e.clientY };
                this.canvas.defaultCursor = 'grabbing';
                this.canvas.selection = false;
            }
        });

        this.canvas.on('mouse:move', (opt) => {
            if (this.isPanning) {
                const deltaX = opt.e.clientX - this.lastPanPosition.x;
                const deltaY = opt.e.clientY - this.lastPanPosition.y;
                
                const vpt = this.canvas.viewportTransform;
                vpt[4] += deltaX;
                vpt[5] += deltaY;
                
                this.canvas.requestRenderAll();
                this.lastPanPosition = { x: opt.e.clientX, y: opt.e.clientY };
            }

            // Update cursor position display
            this._updateCursorPosition(opt);
        });

        this.canvas.on('mouse:up', () => {
            this.isPanning = false;
            if (this.isPanMode) {
                this.canvas.defaultCursor = 'grab';
                this.canvas.selection = false;
            } else {
                this.canvas.defaultCursor = 'default';
                this.canvas.selection = true;
            }
        });

        // Prevent context menu on right click
        this.canvasElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    /**
     * Enable/disable pan mode (Hand tool)
     * @param {boolean} enabled 
     */
    setPanMode(enabled) {
        this.isPanMode = enabled;
        this.canvas.selection = !enabled;
        this.canvas.defaultCursor = enabled ? 'grab' : 'default';
        
        this.canvas.forEachObject(obj => {
            if (enabled) {
                // Disable selection for all objects in pan mode
                obj.selectable = false;
                obj.evented = false;
            } else {
                // Restore selection based on lock state
                // If object is locked, it should remain unselectable
                const isLocked = obj.isLocked === true;
                obj.selectable = !isLocked;
                obj.evented = !isLocked;
            }
        });
        
        this.canvas.requestRenderAll();
    }

    /**
     * Update cursor position display
     * @private
     */
    _updateCursorPosition(opt) {
        const pointer = this.canvas.getPointer(opt.e);
        const posDisplay = document.getElementById('cursor-position');
        if (posDisplay) {
            posDisplay.textContent = `X: ${Math.round(pointer.x)}, Y: ${Math.round(pointer.y)}`;
        }
    }

    /**
     * Update wrapper size to match canvas
     * @private
     */
    _updateWrapperSize() {
        if (this.wrapper) {
            this.wrapper.style.width = `${this.width * this.zoom}px`;
            this.wrapper.style.height = `${this.height * this.zoom}px`;
        }
    }

    /**
     * Set canvas zoom level
     * @param {number} newZoom - New zoom level
     * @param {Object} point - Point to zoom around
     */
    setZoom(newZoom, point = null) {
        // Clamp zoom value
        newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
        
        if (point) {
            // Zoom around specific point
            this.canvas.zoomToPoint(new fabric.Point(point.x, point.y), newZoom);
        } else {
            // Zoom from center
            const center = this.canvas.getCenter();
            this.canvas.zoomToPoint(new fabric.Point(center.left, center.top), newZoom);
        }
        
        this.zoom = newZoom;
        this._updateZoomDisplay();
        this._updateWrapperSize();
    }

    /**
     * Zoom in by step amount
     */
    zoomIn() {
        this.setZoom(this.zoom + this.zoomStep);
    }

    /**
     * Zoom out by step amount
     */
    zoomOut() {
        this.setZoom(this.zoom - this.zoomStep);
    }

    /**
     * Fit canvas to available space
     */
    fitToScreen() {
        const areaRect = this.canvasArea.getBoundingClientRect();
        const padding = 60;
        
        const scaleX = (areaRect.width - padding) / this.width;
        const scaleY = (areaRect.height - padding) / this.height;
        const scale = Math.min(scaleX, scaleY, 1);
        
        this.setZoom(scale);
        this.resetPan();
    }

    /**
     * Reset pan to center canvas
     */
    resetPan() {
        this.canvas.viewportTransform[4] = 0;
        this.canvas.viewportTransform[5] = 0;
        this.canvas.requestRenderAll();
    }

    /**
     * Reset zoom to 100%
     */
    resetZoom() {
        this.setZoom(1);
        this.resetPan();
    }

    /**
     * Update zoom display in UI
     * @private
     */
    _updateZoomDisplay() {
        const zoomDisplay = document.getElementById('zoom-level');
        if (zoomDisplay) {
            zoomDisplay.textContent = `${Math.round(this.zoom * 100)}%`;
        }
    }

    /**
     * Resize canvas dimensions
     * @param {number} width 
     * @param {number} height 
     */
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.canvas.setWidth(width);
        this.canvas.setHeight(height);
        this._updateWrapperSize();
        this._updateDimensionsDisplay();
    }

    /**
     * Update dimensions display
     * @private
     */
    _updateDimensionsDisplay() {
        const dimDisplay = document.getElementById('image-dimensions');
        if (dimDisplay) {
            dimDisplay.textContent = `${this.width} × ${this.height}`;
        }
    }

    /**
     * Load image onto canvas
     * @param {string} src - Image source (URL or base64)
     * @returns {Promise<fabric.FabricImage>}
     */
    async loadImage(src) {
        try {
            // Fabric.js v6: FabricImage.fromURL returns a Promise
            const img = await fabric.FabricImage.fromURL(src, { crossOrigin: 'anonymous' });
            
            if (!img) {
                throw new Error('Failed to load image');
            }

            // Security: Limit image dimensions to prevent memory exhaustion
            const MAX_DIMENSION = 16384;
            const MAX_PIXELS = 25_000_000; // 25 megapixels
            
            if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
                throw new Error(`Image dimensions (${img.width}x${img.height}) exceed maximum of ${MAX_DIMENSION}px`);
            }
            
            if (img.width * img.height > MAX_PIXELS) {
                throw new Error(`Image size (${(img.width * img.height / 1_000_000).toFixed(1)}MP) exceeds maximum of 25MP`);
            }

            // Resize canvas to fit image
            this.resize(img.width, img.height);
            
            // Center image on canvas
            img.set({
                left: 0,
                top: 0,
                selectable: true,
                evented: true,
                id: 'image_' + Date.now(),
                layerId: 'layer_' + Date.now(),
                objectCaching: true // Performance: Enable Fabric.js object caching
            });

            this.canvas.clear();
            this.canvas.backgroundColor = '#ffffff';
            this.canvas.add(img);
            this.canvas.renderAll();
            this.fitToScreen();
            
            return img;
        } catch (error) {
            throw new Error(error.message || 'Failed to load image');
        }
    }

    /**
     * Add image as a new layer (does NOT clear canvas)
     * @param {string} src - Image source (URL or base64)
     * @returns {Promise<fabric.FabricImage>}
     */
    async addImage(src) {
        try {
            const img = await fabric.FabricImage.fromURL(src, { crossOrigin: 'anonymous' });
            
            if (!img) {
                throw new Error('Failed to load image');
            }

            // Security: Limit image dimensions
            const MAX_DIMENSION = 16384;
            const MAX_PIXELS = 25_000_000;
            
            if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
                throw new Error(`Image dimensions (${img.width}x${img.height}) exceed maximum of ${MAX_DIMENSION}px`);
            }
            
            if (img.width * img.height > MAX_PIXELS) {
                throw new Error(`Image size (${(img.width * img.height / 1_000_000).toFixed(1)}MP) exceeds maximum of 25MP`);
            }

            // Scale image to fit within current canvas if larger
            let scale = 1;
            if (img.width > this.width || img.height > this.height) {
                const scaleX = this.width / img.width;
                const scaleY = this.height / img.height;
                scale = Math.min(scaleX, scaleY) * 0.8; // 80% of canvas for margin
            }

            // Center the image on canvas
            const centerX = (this.width - img.width * scale) / 2;
            const centerY = (this.height - img.height * scale) / 2;

            const timestamp = Date.now();
            img.set({
                left: centerX,
                top: centerY,
                scaleX: scale,
                scaleY: scale,
                selectable: true,
                evented: true,
                id: 'image_' + timestamp,
                layerId: 'layer_' + timestamp,
                layerName: 'Image Layer',
                objectCaching: true // Performance: Enable Fabric.js object caching
            });

            this.canvas.add(img);
            this.canvas.setActiveObject(img);
            this.canvas.requestRenderAll();
            
            return img;
        } catch (error) {
            throw new Error(error.message || 'Failed to add image');
        }
    }

    /**
     * Create new blank canvas
     * @param {number} width 
     * @param {number} height 
     * @param {string} backgroundColor 
     */
    createNew(width, height, backgroundColor = '#ffffff') {
        this.resize(width, height);
        this.canvas.clear();
        this.canvas.backgroundColor = backgroundColor;
        this.canvas.renderAll();
        this.fitToScreen();
    }

    /**
     * Export canvas as data URL
     * @param {Object} options
     * @returns {string}
     */
    exportAsDataURL(options = {}) {
        const format = options.format || 'png';
        const quality = (options.quality || 90) / 100;
        
        return this.canvas.toDataURL({
            format: format,
            quality: quality,
            multiplier: 1
        });
    }

    /**
     * Get the active/selected object
     * @returns {fabric.Object|null}
     */
    getActiveObject() {
        return this.canvas.getActiveObject();
    }

    /**
     * Get all objects on canvas
     * @returns {fabric.Object[]}
     */
    getObjects() {
        return this.canvas.getObjects();
    }

    /**
     * Clear selection
     */
    discardActiveObject() {
        this.canvas.discardActiveObject();
        this.canvas.requestRenderAll();
    }

    /**
     * Render canvas
     */
    render() {
        this.canvas.requestRenderAll();
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasManager;
}
