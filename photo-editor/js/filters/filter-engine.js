/**
 * =====================================================
 * PhotoLite - Filter Engine
 * Image adjustments and filter effects
 * =====================================================
 */

class FilterEngine {
    constructor(canvasManager, historyManager) {
        this.canvasManager = canvasManager;
        this.historyManager = historyManager;
        this.canvas = canvasManager.canvas;
        
        // Current adjustment values
        this.adjustments = {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            hue: 0,
            exposure: 0
        };

        // Active filter
        this.activeFilter = 'none';

        // Debouncing for live preview
        this._rafId = null;
        this._pendingAdjustments = false;

        this._initEventListeners();
    }

    /**
     * Initialize event listeners
     * @private
     */
    _initEventListeners() {
        // Adjustment sliders
        const sliders = {
            'adj-brightness': 'brightness',
            'adj-contrast': 'contrast',
            'adj-saturation': 'saturation',
            'adj-hue': 'hue',
            'adj-exposure': 'exposure'
        };

        Object.entries(sliders).forEach(([id, prop]) => {
            const slider = document.getElementById(id);
            if (slider) {
                // Live preview on input (while dragging)
                slider.addEventListener('input', (e) => {
                    this.adjustments[prop] = parseInt(e.target.value);
                    this._updateSliderDisplay(slider);
                    this._scheduleApplyAdjustments();
                });

                // Save to history only on change (mouse release)
                slider.addEventListener('change', () => {
                    // Cancel any pending RAF to ensure final value is applied
                    this._cancelScheduledAdjustments();
                    this._applyAdjustments();
                    this.historyManager.saveState(this.canvas, `Adjust ${prop}`);
                });
            }
        });

        // Reset button
        document.getElementById('btn-reset-adjustments')?.addEventListener('click', () => {
            this.resetAdjustments();
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                this.applyFilter(filter);
                
                // Update active state
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    /**
     * Update slider display value
     * @private
     */
    _updateSliderDisplay(slider) {
        const valueDisplay = slider.nextElementSibling;
        if (valueDisplay && valueDisplay.classList.contains('adjustment-value')) {
            valueDisplay.textContent = slider.value;
        }

        // Update slider track fill
        const min = parseInt(slider.min);
        const max = parseInt(slider.max);
        const value = parseInt(slider.value);
        const percentage = ((value - min) / (max - min)) * 100;
        slider.style.setProperty('--value', `${percentage}%`);
    }

    /**
     * Schedule filter application using requestAnimationFrame for smooth live preview
     * @private
     */
    _scheduleApplyAdjustments() {
        if (this._pendingAdjustments) return;
        
        this._pendingAdjustments = true;
        this._rafId = requestAnimationFrame(() => {
            this._pendingAdjustments = false;
            this._applyAdjustments();
        });
    }

    /**
     * Cancel any scheduled adjustment application
     * @private
     */
    _cancelScheduledAdjustments() {
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        this._pendingAdjustments = false;
    }

    /**
     * Apply current adjustments to active object or all images
     * @private
     */
    _applyAdjustments() {
        const activeObject = this.canvas.getActiveObject();
        const targets = activeObject ? [activeObject] : this.canvas.getObjects('image');

        targets.forEach(obj => {
            if (obj.type === 'image') {
                this._applyFiltersToObject(obj);
            }
        });

        this.canvas.requestRenderAll();
    }

    /**
     * Apply filters to a specific object
     * @private
     */
    _applyFiltersToObject(obj) {
        // Clear existing filters
        obj.filters = [];

        // Fabric.js v6: filters are in fabric.filters namespace
        const filters = fabric.filters;

        // Brightness (-1 to 1)
        if (this.adjustments.brightness !== 0) {
            obj.filters.push(new filters.Brightness({
                brightness: this.adjustments.brightness / 100
            }));
        }

        // Contrast (-1 to 1)
        if (this.adjustments.contrast !== 0) {
            obj.filters.push(new filters.Contrast({
                contrast: this.adjustments.contrast / 100
            }));
        }

        // Saturation (-1 to 1)
        if (this.adjustments.saturation !== 0) {
            obj.filters.push(new filters.Saturation({
                saturation: this.adjustments.saturation / 100
            }));
        }

        // Hue rotation
        if (this.adjustments.hue !== 0) {
            obj.filters.push(new filters.HueRotation({
                rotation: this.adjustments.hue / 180
            }));
        }

        // Exposure (using gamma as approximation)
        if (this.adjustments.exposure !== 0) {
            const gamma = this.adjustments.exposure > 0 
                ? 1 + (this.adjustments.exposure / 100)
                : 1 / (1 + Math.abs(this.adjustments.exposure) / 100);
            obj.filters.push(new filters.Gamma({
                gamma: [gamma, gamma, gamma]
            }));
        }

        // Apply active filter
        this._applyActiveFilter(obj);

        // Apply all filters
        obj.applyFilters();
    }

    /**
     * Apply active filter to object
     * @private
     */
    _applyActiveFilter(obj) {
        // Fabric.js v6: filters are in fabric.filters namespace
        const filters = fabric.filters;
        
        switch (this.activeFilter) {
            case 'grayscale':
                obj.filters.push(new filters.Grayscale());
                break;
            case 'sepia':
                obj.filters.push(new filters.Sepia());
                break;
            case 'invert':
                obj.filters.push(new filters.Invert());
                break;
            case 'blur':
                obj.filters.push(new filters.Blur({ blur: 0.2 }));
                break;
            case 'sharpen':
                obj.filters.push(new filters.Convolute({
                    matrix: [0, -1, 0, -1, 5, -1, 0, -1, 0]
                }));
                break;
            case 'emboss':
                obj.filters.push(new filters.Convolute({
                    matrix: [-2, -1, 0, -1, 1, 1, 0, 1, 2]
                }));
                break;
            case 'vignette':
                // Vignette is handled differently - using gradient overlay
                break;
        }
    }

    /**
     * Apply a named filter
     * @param {string} filterName 
     */
    applyFilter(filterName) {
        this.activeFilter = filterName;
        this._applyAdjustments();
        this.historyManager.saveState(this.canvas, `Apply ${filterName} filter`);
    }

    /**
     * Reset all adjustments
     */
    resetAdjustments() {
        this.adjustments = {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            hue: 0,
            exposure: 0
        };
        this.activeFilter = 'none';

        // Reset slider values
        Object.entries(this.adjustments).forEach(([key, value]) => {
            const slider = document.getElementById(`adj-${key}`);
            if (slider) {
                slider.value = value;
                this._updateSliderDisplay(slider);
            }
        });

        // Reset filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === 'none') {
                btn.classList.add('active');
            }
        });

        this._applyAdjustments();
        this.historyManager.saveState(this.canvas, 'Reset adjustments');
    }

    /**
     * Apply custom convolution matrix
     * @param {number[]} matrix - 3x3 or 5x5 convolution matrix
     */
    applyConvolution(matrix) {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && activeObject.type === 'image') {
            activeObject.filters.push(new fabric.filters.Convolute({
                matrix: matrix
            }));
            activeObject.applyFilters();
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Apply convolution');
        }
    }

    /**
     * Apply Gaussian blur
     * @param {number} radius - Blur radius (0-1)
     */
    applyBlur(radius = 0.1) {
        const activeObject = this.canvas.getActiveObject();
        const targets = activeObject ? [activeObject] : this.canvas.getObjects('image');

        targets.forEach(obj => {
            if (obj.type === 'image') {
                obj.filters.push(new fabric.filters.Blur({ blur: radius }));
                obj.applyFilters();
            }
        });

        this.canvas.requestRenderAll();
        this.historyManager.saveState(this.canvas, 'Apply blur');
    }

    /**
     * Apply sharpening
     * @param {number} intensity - Sharpening intensity
     */
    applySharpen(intensity = 1) {
        const matrix = [
            0, -intensity, 0,
            -intensity, 1 + 4 * intensity, -intensity,
            0, -intensity, 0
        ];
        this.applyConvolution(matrix);
    }

    /**
     * Apply edge detection
     */
    applyEdgeDetection() {
        this.applyConvolution([
            -1, -1, -1,
            -1, 8, -1,
            -1, -1, -1
        ]);
    }

    /**
     * Apply posterize effect
     * @param {number} levels - Number of color levels
     */
    applyPosterize(levels = 4) {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && activeObject.type === 'image') {
            // Posterize using color matrix
            const step = 255 / levels;
            activeObject.filters.push(new fabric.filters.Pixelate({
                blocksize: 1
            }));
            activeObject.applyFilters();
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Apply posterize');
        }
    }

    /**
     * Apply noise reduction
     */
    applyNoiseReduction() {
        this.applyConvolution([
            1/9, 1/9, 1/9,
            1/9, 1/9, 1/9,
            1/9, 1/9, 1/9
        ]);
    }

    /**
     * Get current adjustment values
     * @returns {Object}
     */
    getAdjustments() {
        return { ...this.adjustments };
    }

    /**
     * Set adjustment values programmatically
     * @param {Object} values 
     */
    setAdjustments(values) {
        this.adjustments = { ...this.adjustments, ...values };
        
        // Update UI
        Object.entries(this.adjustments).forEach(([key, value]) => {
            const slider = document.getElementById(`adj-${key}`);
            if (slider) {
                slider.value = value;
                this._updateSliderDisplay(slider);
            }
        });

        this._applyAdjustments();
    }

    /**
     * Apply color tint
     * @param {string} color - Hex color
     * @param {number} intensity - Tint intensity (0-1)
     */
    applyColorTint(color, intensity = 0.3) {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && activeObject.type === 'image') {
            const rgb = this._hexToRgb(color);
            if (rgb) {
                activeObject.filters.push(new fabric.filters.BlendColor({
                    color: color,
                    mode: 'tint',
                    alpha: intensity
                }));
                activeObject.applyFilters();
                this.canvas.requestRenderAll();
                this.historyManager.saveState(this.canvas, 'Apply color tint');
            }
        }
    }

    /**
     * Convert hex color to RGB
     * @private
     */
    _hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    /**
     * Auto-enhance image
     */
    autoEnhance() {
        this.setAdjustments({
            brightness: 5,
            contrast: 10,
            saturation: 15,
            exposure: 0,
            hue: 0
        });
        this.historyManager.saveState(this.canvas, 'Auto enhance');
    }

    /**
     * Apply vintage effect
     */
    applyVintageEffect() {
        this.setAdjustments({
            brightness: -5,
            contrast: 10,
            saturation: -30,
            hue: 0,
            exposure: 0
        });
        this.applyFilter('sepia');
    }

    /**
     * Apply dramatic effect
     */
    applyDramaticEffect() {
        this.setAdjustments({
            brightness: -10,
            contrast: 40,
            saturation: 20,
            hue: 0,
            exposure: 0
        });
        this._applyAdjustments();
        this.historyManager.saveState(this.canvas, 'Apply dramatic effect');
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FilterEngine;
}
