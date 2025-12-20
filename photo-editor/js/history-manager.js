/**
 * =====================================================
 * PhotoLite - History Manager
 * Undo/Redo stack implementation with state snapshots
 * =====================================================
 */

class HistoryManager {
    constructor(maxStates = 50) {
        this.states = [];
        this.currentIndex = -1;
        this.maxStates = maxStates;
        this.isRestoring = false;
        this.listeners = {
            change: []
        };
    }

    /**
     * Save current canvas state
     * @param {fabric.Canvas} canvas - The Fabric.js canvas
     * @param {string} action - Description of the action
     * @param {Object} canvasManager - Optional canvas manager for dimensions
     */
    saveState(canvas, action = 'Edit', canvasManager = null) {
        if (this.isRestoring) return;

        // Remove any states after current index (for new branch)
        if (this.currentIndex < this.states.length - 1) {
            this.states = this.states.slice(0, this.currentIndex + 1);
        }

        // Serialize canvas state including custom properties
        const state = {
            json: canvas.toJSON(['id', 'layerId', 'layerName', 'selectable', 'evented']),
            action: action,
            timestamp: Date.now(),
            // Store canvas dimensions for proper restoration
            canvasWidth: canvas.getWidth(),
            canvasHeight: canvas.getHeight(),
            backgroundColor: canvas.backgroundColor
        };

        this.states.push(state);
        this.currentIndex++;

        // Limit history size (O(1) amortized with shift)
        if (this.states.length > this.maxStates) {
            this.states.shift();
            this.currentIndex--;
        }

        this._notifyChange();
    }

    /**
     * Undo to previous state
     * @param {fabric.Canvas} canvas - The Fabric.js canvas
     * @returns {boolean} Success status
     */
    undo(canvas) {
        if (!this.canUndo()) return false;

        this.currentIndex--;
        return this._restoreState(canvas, this.states[this.currentIndex]);
    }

    /**
     * Redo to next state
     * @param {fabric.Canvas} canvas - The Fabric.js canvas
     * @returns {boolean} Success status
     */
    redo(canvas) {
        if (!this.canRedo()) return false;

        this.currentIndex++;
        return this._restoreState(canvas, this.states[this.currentIndex]);
    }

    /**
     * Check if undo is possible
     * @returns {boolean}
     */
    canUndo() {
        return this.currentIndex > 0;
    }

    /**
     * Check if redo is possible
     * @returns {boolean}
     */
    canRedo() {
        return this.currentIndex < this.states.length - 1;
    }

    /**
     * Restore canvas from state
     * @private
     */
    async _restoreState(canvas, state) {
        if (!state) return false;

        this.isRestoring = true;

        // First, restore canvas dimensions if they were saved
        if (state.canvasWidth && state.canvasHeight) {
            if (canvas.getWidth() !== state.canvasWidth || canvas.getHeight() !== state.canvasHeight) {
                canvas.setWidth(state.canvasWidth);
                canvas.setHeight(state.canvasHeight);
            }
        }
        
        // Restore background color
        if (state.backgroundColor !== undefined && canvas.backgroundColor !== state.backgroundColor) {
            canvas.backgroundColor = state.backgroundColor;
        }

        // Restore canvas state directly (trusted internal state)
        // Optimization: Removed redundant sanitization/cloning which was causing ~80-100ms delay on large states
        await canvas.loadFromJSON(state.json);
        
        canvas.renderAll();
        this.isRestoring = false;
        this._notifyChange();
        
        // Dispatch custom event for canvas manager to update
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('canvas:restored', {
                detail: {
                    width: state.canvasWidth,
                    height: state.canvasHeight
                }
            }));
        }
        
        return true;
    }

    /**
     * Clear all history
     */
    clear() {
        this.states = [];
        this.currentIndex = -1;
        this._notifyChange();
    }

    /**
     * Get current state info
     * @returns {Object}
     */
    getInfo() {
        return {
            totalStates: this.states.length,
            currentIndex: this.currentIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            currentAction: this.states[this.currentIndex]?.action || 'Initial'
        };
    }

    /**
     * Subscribe to history changes
     * @param {Function} callback
     */
    onChange(callback) {
        this.listeners.change.push(callback);
    }

    /**
     * Notify all listeners of state change
     * @private
     */
    _notifyChange() {
        const info = this.getInfo();
        this.listeners.change.forEach(cb => cb(info));
    }

    /**
     * Get history list for display
     * @returns {Array}
     */
    getHistoryList() {
        return this.states.map((state, index) => ({
            action: state.action,
            timestamp: state.timestamp,
            isCurrent: index === this.currentIndex,
            isFuture: index > this.currentIndex
        }));
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HistoryManager;
}
