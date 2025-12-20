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
        this.thumbnailCache = {}; // Cache for layer thumbnails
        
        this.layersList = document.getElementById('layers-list');
        
        this._initEventListeners();
        this._initDragAndDrop(); // Initialize drag & drop once
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
            // Clear thumbnail cache for removed layer
            if (e.target?.layerId) {
                this._thumbCache?.delete(e.target.layerId);
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


        // Invalidate thumbnail cache on modification
        this.canvas.on('object:modified', (e) => {
            if (e.target && e.target.layerId) {
                delete this.thumbnailCache[e.target.layerId];
            }
        });

        // Performance: Initialize thumbnail cache as Map for faster lookups
        this._thumbCache = new Map();

        // Performance: Event delegation for layer list clicks
        // Single listener handles all layer interactions
        this.layersList?.addEventListener('click', (e) => {
            const layerItem = e.target.closest('.layer-item');
            if (!layerItem) return;
            
            const layerId = layerItem.dataset.layerId;
            
            if (e.target.closest('.layer-visibility')) {
                e.stopPropagation();
                this.toggleLayerVisibility(layerId);
            } else if (e.target.closest('.layer-lock')) {
                e.stopPropagation();
                this.toggleLayerLock(layerId);
            } else {
                this.selectLayer(layerId);
            }
        });


        // Add layer button
        document.getElementById('btn-add-layer')?.addEventListener('click', () => {
            this.addEmptyLayer();
        });

        // Delete layer button
        document.getElementById('btn-delete-layer')?.addEventListener('click', () => {
            this.deleteActiveLayer();
        });

        // Layer ordering buttons
        document.getElementById('btn-layer-up')?.addEventListener('click', () => {
            this.bringActiveForward();
        });

        document.getElementById('btn-layer-down')?.addEventListener('click', () => {
            this.sendActiveBackward();
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

        // Clean up cache for removed layers
        const activeIds = new Set(this.layers.map(l => l.id));
        Object.keys(this.thumbnailCache).forEach(id => {
            if (!activeIds.has(id)) {
                delete this.thumbnailCache[id];
            }
        });

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

        // Generate thumbnails (with caching)
        this._generateThumbnails();
        
        // Note: Event listeners handled by delegation in _initEventListeners()
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
     * Performance: Uses cached thumbnails and reusable StaticCanvas
     * @private
     */
    _generateThumbnails() {
        // Performance: Reuse single StaticCanvas for all thumbnails
        if (!this._sharedThumbCanvas) {
            this._sharedThumbCanvas = new fabric.StaticCanvas(null, {
                width: 40,
                height: 40,
                backgroundColor: 'transparent'
            });
        }
        
        this.layers.forEach(async (layer) => {
            const layerEl = this.layersList.querySelector(`[data-layer-id="${layer.id}"]`);
            if (!layerEl) return;

            const thumbCanvas = layerEl.querySelector('.layer-thumbnail canvas');
            if (!thumbCanvas || !layer.object) return;

            const ctx = thumbCanvas.getContext('2d');
            ctx.clearRect(0, 0, 40, 40);

            // Check cache first
            if (this.thumbnailCache[layer.id]) {
                const img = new Image();
                img.onload = () => ctx.drawImage(img, 0, 0);
                img.src = this.thumbnailCache[layer.id];
                return;
            }

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

                // Performance: Reuse shared canvas instead of creating new one
                this._sharedThumbCanvas.clear();
                this._sharedThumbCanvas.add(cloned);
                this._sharedThumbCanvas.renderAll();

                // Cache the result as data URL
                const dataURL = this._sharedThumbCanvas.toDataURL({ format: 'png', multiplier: 1 });
                this.thumbnailCache[layer.id] = dataURL;

                ctx.drawImage(this._sharedThumbCanvas.getElement(), 0, 0);
            } catch (e) {
                // Silently fail - thumbnails are non-critical
            }
        });
    }

    // Note: _addLayerEventListeners removed - event delegation in _initEventListeners() handles all clicks

    /**
     * Initialize drag and drop for layer reordering
     * Uses mouse-based sorting for better compatibility
     * @private
     */
    _initDragAndDrop() {
        if (this._dragDropInitialized) return;
        this._dragDropInitialized = true;
        
        const self = this;
        let draggedEl = null;
        let draggedId = null;
        let placeholder = null;
        let startY = 0;
        let isDragging = false;
        
        // Mouse-based sorting (works everywhere)
        this.layersList.addEventListener('mousedown', function(e) {
            // Only left click, not on buttons
            if (e.button !== 0) return;
            if (e.target.closest('button')) return;
            
            const layerItem = e.target.closest('.layer-item');
            if (!layerItem) return;
            
            // Start drag after a small delay to distinguish from click
            startY = e.clientY;
            draggedEl = layerItem;
            draggedId = layerItem.dataset.layerId;
            
            // Prevent text selection
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', function(e) {
            if (!draggedEl) return;
            
            // Only start dragging after moving 5px
            if (!isDragging && Math.abs(e.clientY - startY) < 5) return;
            
            if (!isDragging) {
                isDragging = true;
                draggedEl.classList.add('dragging');
                
                // Create placeholder
                placeholder = document.createElement('div');
                placeholder.className = 'layer-item-placeholder';
                placeholder.style.height = draggedEl.offsetHeight + 'px';
                placeholder.style.background = 'rgba(255, 255, 255, 0.1)';
                placeholder.style.border = '2px dashed rgba(255, 255, 255, 0.3)';
                placeholder.style.borderRadius = '8px';
                placeholder.style.marginBottom = '4px';
            }
            
            // Find drop target
            const items = Array.from(self.layersList.querySelectorAll('.layer-item:not(.dragging)'));
            let targetItem = null;
            
            for (const item of items) {
                const rect = item.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                
                if (e.clientY < midY) {
                    targetItem = item;
                    break;
                }
            }
            
            // Update visual feedback
            items.forEach(item => item.classList.remove('drag-over'));
            
            if (targetItem) {
                targetItem.classList.add('drag-over');
            }
        });
        
        document.addEventListener('mouseup', function(e) {
            if (!draggedEl) return;
            
            if (isDragging) {
                // Find drop target
                const items = Array.from(self.layersList.querySelectorAll('.layer-item:not(.dragging)'));
                let targetItem = null;
                
                for (const item of items) {
                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    
                    if (e.clientY < midY) {
                        targetItem = item;
                        break;
                    }
                }
                
                // If no target found, drop at end (bottom layer)
                if (!targetItem && items.length > 0) {
                    targetItem = items[items.length - 1];
                }
                
                // Perform reorder
                if (targetItem && targetItem.dataset.layerId !== draggedId) {
                    const toId = targetItem.dataset.layerId;
                    self.reorderLayers(draggedId, toId);
                }
                
                // Cleanup
                draggedEl.classList.remove('dragging');
                items.forEach(item => item.classList.remove('drag-over'));
                if (placeholder && placeholder.parentNode) {
                    placeholder.parentNode.removeChild(placeholder);
                }
            }
            
            draggedEl = null;
            draggedId = null;
            placeholder = null;
            isDragging = false;
        });
        
        // Also keep HTML5 drag-drop for browsers that prefer it
        this.layersList.addEventListener('dragstart', function(e) {
            const layerItem = e.target.closest('.layer-item');
            if (!layerItem) return;
            
            self._draggedLayerId = layerItem.dataset.layerId;
            layerItem.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', self._draggedLayerId || '');
        }, false);
        
        this.layersList.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const layerItem = e.target.closest('.layer-item');
            if (layerItem && layerItem.dataset.layerId !== self._draggedLayerId) {
                self.layersList.querySelectorAll('.layer-item').forEach(item => {
                    item.classList.remove('drag-over');
                });
                layerItem.classList.add('drag-over');
            }
        }, false);
        
        this.layersList.addEventListener('drop', function(e) {
            e.preventDefault();
            
            const targetItem = e.target.closest('.layer-item');
            self.layersList.querySelectorAll('.layer-item').forEach(item => {
                item.classList.remove('drag-over', 'dragging');
            });
            
            if (!targetItem) return;
            
            const fromId = self._draggedLayerId || e.dataTransfer.getData('text/plain');
            const toId = targetItem.dataset.layerId;
            
            if (fromId && toId && fromId !== toId) {
                self.reorderLayers(fromId, toId);
            }
            
            self._draggedLayerId = null;
        }, false);
        
        this.layersList.addEventListener('dragend', function(e) {
            self.layersList.querySelectorAll('.layer-item').forEach(item => {
                item.classList.remove('dragging', 'drag-over');
            });
            self._draggedLayerId = null;
        }, false);
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
     * Bring layer to front (top of stack)
     * @param {string} layerId 
     */
    bringToFront(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer && layer.object) {
            this.canvas.bringObjectToFront(layer.object);
            this.canvas.requestRenderAll();
            this._syncLayersFromCanvas();
        }
    }

    /**
     * Send layer to back (bottom of stack)
     * @param {string} layerId 
     */
    sendToBack(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer && layer.object) {
            this.canvas.sendObjectToBack(layer.object);
            this.canvas.requestRenderAll();
            this._syncLayersFromCanvas();
        }
    }

    /**
     * Bring layer forward (one step up)
     * @param {string} layerId 
     */
    bringForward(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer && layer.object) {
            this.canvas.bringObjectForward(layer.object);
            this.canvas.requestRenderAll();
            this._syncLayersFromCanvas();
        }
    }

    /**
     * Send layer backward (one step down)
     * @param {string} layerId 
     */
    sendBackward(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer && layer.object) {
            this.canvas.sendObjectBackwards(layer.object);
            this.canvas.requestRenderAll();
            this._syncLayersFromCanvas();
        }
    }

    /**
     * Bring active layer to front
     */
    bringActiveToFront() {
        if (this.activeLayerId) {
            this.bringToFront(this.activeLayerId);
        }
    }

    /**
     * Send active layer to back
     */
    sendActiveToBack() {
        if (this.activeLayerId) {
            this.sendToBack(this.activeLayerId);
        }
    }

    /**
     * Bring active layer forward
     */
    bringActiveForward() {
        if (this.activeLayerId) {
            this.bringForward(this.activeLayerId);
        }
    }

    /**
     * Send active layer backward
     */
    sendActiveBackward() {
        if (this.activeLayerId) {
            this.sendBackward(this.activeLayerId);
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
        // Optimization: Use canvas element directly to avoid PNG encoding/decoding
        const element = this.canvas.toCanvasElement({
            multiplier: 1,
            format: 'png'
        });
        
        try {
            const img = new fabric.FabricImage(element);
            
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
