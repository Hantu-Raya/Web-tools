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
        this.lastPanPosition = { x: 0, y: 0 };
        
        // Initialize Fabric canvas
        this.canvas = new fabric.Canvas(canvasId, {
            width: this.width,
            height: this.height,
            backgroundColor: '#ffffff',
            preserveObjectStacking: true,
            selection: true,
            renderOnAddRemove: true
        });

        // Store original dimensions
        this.originalWidth = this.width;
        this.originalHeight = this.height;

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

        // Pan with middle mouse button or space + drag
        this.canvas.on('mouse:down', (opt) => {
            if (opt.e.button === 1 || (opt.e.altKey && opt.e.button === 0)) {
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
            this.canvas.defaultCursor = 'default';
            this.canvas.selection = true;
        });

        // Prevent context menu on right click
        this.canvasElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
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
     * @returns {Promise<fabric.Image>}
     */
    loadImage(src) {
        return new Promise((resolve, reject) => {
            fabric.Image.fromURL(src, (img) => {
                if (!img) {
                    reject(new Error('Failed to load image'));
                    return;
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
                    layerId: 'layer_' + Date.now()
                });

                this.canvas.clear();
                this.canvas.setBackgroundColor('#ffffff', () => {
                    this.canvas.add(img);
                    this.canvas.renderAll();
                    this.fitToScreen();
                    resolve(img);
                });
            }, { crossOrigin: 'anonymous' });
        });
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
        this.canvas.setBackgroundColor(backgroundColor, () => {
            this.canvas.renderAll();
            this.fitToScreen();
        });
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
