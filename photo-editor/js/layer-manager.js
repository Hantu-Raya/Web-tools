/**
 * =====================================================
 * PhotoLite - Layer Manager
 * Layer operations and panel management
 * =====================================================
 */

class LayerManager {
    constructor(canvasManager) {
        this.canvasManager = canvasManager;
        this.canvas = canvasManager.canvas;
        this.layers = [];
        this.activeLayerId = null;
        this.layerCounter = 0;
        
        this.layersList = document.getElementById('layers-list');
        
        this._initEventListeners();
    }

    /**
     * Initialize event listeners
     * @private
     */
    _initEventListeners() {
        // Listen for canvas object changes
        this.canvas.on('object:added', (e) => {
            // Ignore crop UI elements
            if (e.target.isCropUI || e.target.excludeFromExport) {
                return;
            }
            if (!e.target.layerId) {
                e.target.layerId = this._generateLayerId();
                e.target.layerName = this._generateLayerName(e.target);
            }
            this._syncLayersFromCanvas();
        });

        this.canvas.on('object:removed', (e) => {
            // Ignore crop UI elements
            if (e.target?.isCropUI || e.target?.excludeFromExport) {
                return;
            }
            this._syncLayersFromCanvas();
        });

        this.canvas.on('selection:created', (e) => {
            if (e.selected && e.selected[0] && !e.selected[0].isCropUI) {
                this.setActiveLayer(e.selected[0].layerId);
            }
        });

        this.canvas.on('selection:updated', (e) => {
            if (e.selected && e.selected[0] && !e.selected[0].isCropUI) {
                this.setActiveLayer(e.selected[0].layerId);
            }
        });

        this.canvas.on('selection:cleared', () => {
            this.activeLayerId = null;
            this._renderLayersList();
        });

        // Add layer button
        document.getElementById('btn-add-layer')?.addEventListener('click', () => {
            this.addEmptyLayer();
        });

        // Delete layer button
        document.getElementById('btn-delete-layer')?.addEventListener('click', () => {
            this.deleteActiveLayer();
        });
    }

    /**
     * Generate unique layer ID
     * @private
     */
    _generateLayerId() {
        return `layer_${Date.now()}_${this.layerCounter++}`;
    }

    /**
     * Generate layer name based on object type
     * @private
     */
    _generateLayerName(obj) {
        const type = obj.type || 'object';
        const typeNames = {
            'image': 'Image',
            'rect': 'Rectangle',
            'circle': 'Ellipse',
            'ellipse': 'Ellipse',
            'line': 'Line',
            'path': 'Drawing',
            'i-text': 'Text',
            'textbox': 'Text',
            'group': 'Group'
        };
        return typeNames[type] || 'Layer';
    }

    /**
     * Sync layers array from canvas objects
     * @private
     */
    _syncLayersFromCanvas() {
        const objects = this.canvas.getObjects();
        // Filter out crop UI elements and other non-layer objects
        this.layers = objects
            .filter(obj => !obj.isCropUI && !obj.excludeFromExport)
            .map((obj, index) => ({
                id: obj.layerId,
                name: obj.layerName || `Layer ${index + 1}`,
                type: obj.type,
                visible: obj.visible !== false,
                opacity: obj.opacity || 1,
                locked: obj.isLocked === true,
                object: obj
            })).reverse(); // Reverse for visual top-to-bottom order

        this._renderLayersList();
    }

    /**
     * Render layers list in UI
     * @private
     */
    _renderLayersList() {
        if (!this.layersList) return;

        if (this.layers.length === 0) {
            this.layersList.innerHTML = `
                <div class="panel-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                        <polyline points="2 17 12 22 22 17"/>
                        <polyline points="2 12 12 17 22 12"/>
                    </svg>
                    <p>No layers yet</p>
                </div>
            `;
            return;
        }

        this.layersList.innerHTML = this.layers.map(layer => `
            <div class="layer-item ${layer.id === this.activeLayerId ? 'active' : ''} ${layer.locked ? 'locked' : ''}" 
                 data-layer-id="${this._escapeAttribute(layer.id)}"
                 draggable="true">
                <div class="layer-thumbnail">
                    <canvas width="40" height="40"></canvas>
                </div>
                <div class="layer-info">
                    <span class="layer-name">${this._escapeHtml(layer.name)}</span>
                    <span class="layer-type">${this._escapeHtml(layer.type || 'object')}</span>
                </div>
                <button class="layer-lock ${layer.locked ? 'is-locked' : ''}" 
                        data-layer-id="${this._escapeAttribute(layer.id)}"
                        title="${layer.locked ? 'Unlock Layer' : 'Lock Layer'}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${layer.locked ? 
                            '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' :
                            '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'
                        }
                    </svg>
                </button>
                <button class="layer-visibility ${!layer.visible ? 'hidden' : ''}" 
                        data-layer-id="${this._escapeAttribute(layer.id)}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${layer.visible ? 
                            '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' :
                            '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
                        }
                    </svg>
                </button>
            </div>
        `).join('');

        // Generate thumbnails
        this._generateThumbnails();
        
        // Add click listeners
        this._addLayerEventListeners();
    }

    /**
     * Escape HTML to prevent XSS
     * @private
     */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Escape attribute values to prevent XSS
     * @private
     */
    _escapeAttribute(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * Generate layer thumbnails
     * @private
     */
    _generateThumbnails() {
        this.layers.forEach(async (layer) => {
            const layerEl = this.layersList.querySelector(`[data-layer-id="${layer.id}"]`);
            if (!layerEl) return;

            const thumbCanvas = layerEl.querySelector('.layer-thumbnail canvas');
            if (!thumbCanvas || !layer.object) return;

            const ctx = thumbCanvas.getContext('2d');
            ctx.clearRect(0, 0, 40, 40);

            // Fabric.js v6: clone() returns a Promise
            try {
                const cloned = await layer.object.clone();
                const bounds = cloned.getBoundingRect();
                const scale = Math.min(36 / bounds.width, 36 / bounds.height, 1);
                
                cloned.scale(cloned.scaleX * scale, cloned.scaleY * scale);
                cloned.set({
                    left: 20,
                    top: 20,
                    originX: 'center',
                    originY: 'center'
                });

                const tempCanvas = new fabric.StaticCanvas(null, {
                    width: 40,
                    height: 40,
                    backgroundColor: 'transparent'
                });
                tempCanvas.add(cloned);
                tempCanvas.renderAll();

                ctx.drawImage(tempCanvas.getElement(), 0, 0);
                tempCanvas.dispose();
            } catch (e) {
                console.warn('Failed to generate thumbnail:', e);
            }
        });
    }

    /**
     * Add event listeners to layer items
     * @private
     */
    _addLayerEventListeners() {
        // Layer selection
        this.layersList.querySelectorAll('.layer-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.layer-visibility') || e.target.closest('.layer-lock')) return;
                const layerId = item.dataset.layerId;
                this.selectLayer(layerId);
            });
        });

        // Visibility toggle
        this.layersList.querySelectorAll('.layer-visibility').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const layerId = btn.dataset.layerId;
                this.toggleLayerVisibility(layerId);
            });
        });

        // Lock toggle
        this.layersList.querySelectorAll('.layer-lock').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const layerId = btn.dataset.layerId;
                this.toggleLayerLock(layerId);
            });
        });

        // Drag and drop reordering
        this._initDragAndDrop();
    }

    /**
     * Initialize drag and drop for layer reordering
     * @private
     */
    _initDragAndDrop() {
        let draggedItem = null;

        this.layersList.querySelectorAll('.layer-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                draggedItem = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                if (draggedItem && draggedItem !== item) {
                    const fromId = draggedItem.dataset.layerId;
                    const toId = item.dataset.layerId;
                    this.reorderLayers(fromId, toId);
                }
            });
        });
    }

    /**
     * Select a layer
     */
    selectLayer(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer && layer.object) {
            this.canvas.setActiveObject(layer.object);
            this.canvas.requestRenderAll();
            this.activeLayerId = layerId;
            this._renderLayersList();
        }
    }

    /**
     * Set active layer without selecting object
     */
    setActiveLayer(layerId) {
        this.activeLayerId = layerId;
        this._renderLayersList();
    }

    /**
     * Toggle layer visibility
     */
    toggleLayerVisibility(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer && layer.object) {
            layer.object.visible = !layer.object.visible;
            layer.visible = layer.object.visible;
            this.canvas.requestRenderAll();
            this._renderLayersList();
        }
    }

    /**
     * Toggle layer lock state
     * Locked layers cannot be selected, moved, or erased
     */
    toggleLayerLock(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer && layer.object) {
            const isLocked = !layer.object.isLocked;
            layer.object.isLocked = isLocked;
            layer.locked = isLocked;
            
            // Set Fabric.js lock properties
            layer.object.lockMovementX = isLocked;
            layer.object.lockMovementY = isLocked;
            layer.object.lockRotation = isLocked;
            layer.object.lockScalingX = isLocked;
            layer.object.lockScalingY = isLocked;
            layer.object.selectable = !isLocked;
            layer.object.evented = !isLocked;
            
            // Deselect if currently selected and now locked
            if (isLocked && this.canvas.getActiveObject() === layer.object) {
                this.canvas.discardActiveObject();
            }
            
            this.canvas.requestRenderAll();
            this._renderLayersList();
        }
    }

    /**
     * Check if a layer is locked
     * @param {string} layerId 
     * @returns {boolean}
     */
    isLayerLocked(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        return layer ? layer.locked === true : false;
    }

    /**
     * Get all locked layer IDs
     * @returns {string[]}
     */
    getLockedLayerIds() {
        return this.layers.filter(l => l.locked).map(l => l.id);
    }

    /**
     * Set layer opacity
     */
    setLayerOpacity(layerId, opacity) {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer && layer.object) {
            layer.object.set('opacity', opacity);
            layer.opacity = opacity;
            this.canvas.requestRenderAll();
        }
    }

    /**
     * Reorder layers
     */
    reorderLayers(fromId, toId) {
        const fromLayer = this.layers.find(l => l.id === fromId);
        const toLayer = this.layers.find(l => l.id === toId);
        
        if (fromLayer && toLayer && fromLayer.object && toLayer.object) {
            const fromIndex = this.canvas.getObjects().indexOf(fromLayer.object);
            const toIndex = this.canvas.getObjects().indexOf(toLayer.object);
            
            if (fromIndex !== -1 && toIndex !== -1) {
                fromLayer.object.moveTo(toIndex);
                this.canvas.requestRenderAll();
                this._syncLayersFromCanvas();
            }
        }
    }

    /**
     * Add empty layer (rectangle placeholder)
     */
    addEmptyLayer() {
        const rect = new fabric.Rect({
            width: this.canvasManager.width * 0.5,
            height: this.canvasManager.height * 0.5,
            fill: 'transparent',
            stroke: '#cccccc',
            strokeWidth: 1,
            strokeDashArray: [5, 5],
            left: this.canvasManager.width * 0.25,
            top: this.canvasManager.height * 0.25,
            layerId: this._generateLayerId(),
            layerName: 'Empty Layer'
        });

        this.canvas.add(rect);
        this.canvas.setActiveObject(rect);
        this.canvas.requestRenderAll();
    }

    /**
     * Delete active layer
     */
    deleteActiveLayer() {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            this.canvas.remove(activeObject);
            this.canvas.requestRenderAll();
        }
    }

    /**
     * Delete layer by ID
     */
    deleteLayer(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer && layer.object) {
            this.canvas.remove(layer.object);
            this.canvas.requestRenderAll();
        }
    }

    /**
     * Get layer by ID
     */
    getLayer(layerId) {
        return this.layers.find(l => l.id === layerId);
    }

    /**
     * Get all layers
     */
    getLayers() {
        return this.layers;
    }

    /**
     * Rename layer
     */
    renameLayer(layerId, newName) {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
            layer.name = newName;
            if (layer.object) {
                layer.object.layerName = newName;
            }
            this._renderLayersList();
        }
    }

    /**
     * Duplicate layer
     */
    async duplicateLayer(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer && layer.object) {
            // Fabric.js v6: clone() returns a Promise
            try {
                const cloned = await layer.object.clone();
                cloned.set({
                    left: cloned.left + 20,
                    top: cloned.top + 20,
                    layerId: this._generateLayerId(),
                    layerName: layer.name + ' Copy'
                });
                this.canvas.add(cloned);
                this.canvas.setActiveObject(cloned);
                this.canvas.requestRenderAll();
            } catch (e) {
                console.error('Failed to duplicate layer:', e);
            }
        }
    }

    /**
     * Merge visible layers
     */
    mergeVisibleLayers() {
        const visibleObjects = this.canvas.getObjects().filter(obj => obj.visible !== false);
        if (visibleObjects.length < 2) return;

        // Group all visible objects
        const group = new fabric.Group(visibleObjects, {
            layerId: this._generateLayerId(),
            layerName: 'Merged Layer'
        });

        // Remove original objects
        visibleObjects.forEach(obj => this.canvas.remove(obj));

        // Add merged group
        this.canvas.add(group);
        this.canvas.setActiveObject(group);
        this.canvas.requestRenderAll();
    }

    /**
     * Flatten all layers to background
     */
    async flattenImage() {
        const dataURL = this.canvasManager.exportAsDataURL({ format: 'png' });
        
        try {
            // Fabric.js v6: FabricImage.fromURL returns a Promise
            const img = await fabric.FabricImage.fromURL(dataURL, { crossOrigin: 'anonymous' });
            
            this.canvas.clear();
            this.canvas.backgroundColor = '#ffffff';
            
            img.set({
                left: 0,
                top: 0,
                layerId: this._generateLayerId(),
                layerName: 'Flattened Image'
            });
            
            this.canvas.add(img);
            this.canvas.requestRenderAll();
        } catch (e) {
            console.error('Failed to flatten image:', e);
        }
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LayerManager;
}
