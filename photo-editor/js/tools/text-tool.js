/**
 * =====================================================
 * PhotoLite - Text Tool
 * Text creation and editing functionality
 * =====================================================
 */

class TextTool {
    constructor(canvasManager, historyManager) {
        this.canvasManager = canvasManager;
        this.historyManager = historyManager;
        this.canvas = canvasManager.canvas;
        
        this.isActive = false;
        
        // Text properties
        this.fontFamily = 'Inter';
        this.fontSize = 32;
        this.fontWeight = 'normal';
        this.fontStyle = 'normal';
        this.textAlign = 'left';
        this.textColor = '#ffffff';
        this.backgroundColor = 'transparent';

        this._initEventListeners();
    }

    /**
     * Initialize event listeners
     * @private
     */
    _initEventListeners() {
        // Use fill color for text color
        const fillColor = document.getElementById('fill-color');
        fillColor?.addEventListener('input', (e) => {
            this.textColor = e.target.value;
            this._updateSelectedText();
        });

        // Double click to edit text
        this.canvas.on('mouse:dblclick', (opt) => {
            if (opt.target && opt.target.type === 'i-text') {
                opt.target.enterEditing();
            }
        });

        // Save state after text editing
        this.canvas.on('text:changed', () => {
            // Debounce to avoid too many history states
            clearTimeout(this._textChangeTimeout);
            this._textChangeTimeout = setTimeout(() => {
                this.historyManager.saveState(this.canvas, 'Edit Text');
            }, 500);
        });
    }

    /**
     * Activate text tool
     */
    activate() {
        this.isActive = true;
        this.canvas.isDrawingMode = false;
        this.canvas.selection = false;
        this.canvas.defaultCursor = 'text';
        
        // Disable all object selection/movement to allow clicking anywhere for text
        this.canvas.forEachObject(obj => {
            // Store original state
            obj._textToolSelectable = obj.selectable;
            obj._textToolEvented = obj.evented;
            // Disable interaction
            obj.selectable = false;
            obj.evented = false;
        });
        
        this._bindClickHandler();
    }

    /**
     * Deactivate text tool
     */
    deactivate() {
        this.isActive = false;
        this.canvas.selection = true;
        this.canvas.defaultCursor = 'default';
        
        // Restore all object selection/movement
        this.canvas.forEachObject(obj => {
            // Restore original state (respect locked layers)
            const wasSelectable = obj._textToolSelectable !== undefined ? obj._textToolSelectable : true;
            const wasEvented = obj._textToolEvented !== undefined ? obj._textToolEvented : true;
            obj.selectable = wasSelectable && !obj.isLocked;
            obj.evented = wasEvented && !obj.isLocked;
        });
        
        this._unbindClickHandler();
    }

    /**
     * Bind click handler for adding text
     * @private
     */
    _bindClickHandler() {
        this._onClick = this._handleClick.bind(this);
        this.canvas.on('mouse:down', this._onClick);
    }

    /**
     * Unbind click handler
     * @private
     */
    _unbindClickHandler() {
        this.canvas.off('mouse:down', this._onClick);
    }

    /**
     * Handle canvas click
     * @private
     */
    _handleClick(opt) {
        if (!this.isActive) return;
        
        // Since all objects are disabled when text tool is active,
        // we can add text at any click position
        const pointer = this.canvas.getPointer(opt.e);
        this.addText('Text', pointer.x, pointer.y);
    }

    /**
     * Add text at position
     * @param {string} text - Text content
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    addText(text, x, y) {
        const textObj = new fabric.IText(text, {
            left: x,
            top: y,
            fontFamily: this.fontFamily,
            fontSize: this.fontSize,
            fontWeight: this.fontWeight,
            fontStyle: this.fontStyle,
            textAlign: this.textAlign,
            fill: this.textColor,
            backgroundColor: this.backgroundColor,
            layerId: 'layer_' + Date.now(),
            layerName: 'Text Layer',
            editable: true
        });

        this.canvas.add(textObj);
        this.canvas.setActiveObject(textObj);
        textObj.enterEditing();
        textObj.selectAll();
        this.canvas.requestRenderAll();

        this.historyManager.saveState(this.canvas, 'Add Text');

        return textObj;
    }

    /**
     * Update selected text with current properties
     * @private
     */
    _updateSelectedText() {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox')) {
            activeObject.set('fill', this.textColor);
            this.canvas.requestRenderAll();
        }
    }

    /**
     * Set font family
     * @param {string} fontFamily 
     */
    setFontFamily(fontFamily) {
        this.fontFamily = fontFamily;
        
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox')) {
            activeObject.set('fontFamily', fontFamily);
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Change Font');
        }
    }

    /**
     * Set font size
     * @param {number} size 
     */
    setFontSize(size) {
        this.fontSize = size;
        
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox')) {
            activeObject.set('fontSize', size);
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Change Font Size');
        }
    }

    /**
     * Toggle bold
     */
    toggleBold() {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox')) {
            const isBold = activeObject.fontWeight === 'bold';
            activeObject.set('fontWeight', isBold ? 'normal' : 'bold');
            this.fontWeight = activeObject.fontWeight;
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Toggle Bold');
        }
    }

    /**
     * Toggle italic
     */
    toggleItalic() {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox')) {
            const isItalic = activeObject.fontStyle === 'italic';
            activeObject.set('fontStyle', isItalic ? 'normal' : 'italic');
            this.fontStyle = activeObject.fontStyle;
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Toggle Italic');
        }
    }

    /**
     * Toggle underline
     */
    toggleUnderline() {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox')) {
            activeObject.set('underline', !activeObject.underline);
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Toggle Underline');
        }
    }

    /**
     * Set text alignment
     * @param {string} align - 'left', 'center', or 'right'
     */
    setTextAlign(align) {
        this.textAlign = align;
        
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox')) {
            activeObject.set('textAlign', align);
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Change Alignment');
        }
    }

    /**
     * Set text color
     * @param {string} color - Hex color
     */
    setTextColor(color) {
        this.textColor = color;
        this._updateSelectedText();
    }

    /**
     * Set background color
     * @param {string} color - Hex color or 'transparent'
     */
    setBackgroundColor(color) {
        this.backgroundColor = color;
        
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox')) {
            activeObject.set('backgroundColor', color);
            this.canvas.requestRenderAll();
        }
    }

    /**
     * Set line height
     * @param {number} lineHeight 
     */
    setLineHeight(lineHeight) {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox')) {
            activeObject.set('lineHeight', lineHeight);
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Change Line Height');
        }
    }

    /**
     * Set character spacing
     * @param {number} spacing 
     */
    setCharSpacing(spacing) {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox')) {
            activeObject.set('charSpacing', spacing);
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Change Letter Spacing');
        }
    }

    /**
     * Convert text to textbox (multi-line with word wrap)
     */
    convertToTextbox() {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && activeObject.type === 'i-text') {
            const textbox = new fabric.Textbox(activeObject.text, {
                left: activeObject.left,
                top: activeObject.top,
                width: activeObject.width,
                fontFamily: activeObject.fontFamily,
                fontSize: activeObject.fontSize,
                fontWeight: activeObject.fontWeight,
                fontStyle: activeObject.fontStyle,
                fill: activeObject.fill,
                layerId: activeObject.layerId,
                layerName: activeObject.layerName
            });

            this.canvas.remove(activeObject);
            this.canvas.add(textbox);
            this.canvas.setActiveObject(textbox);
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Convert to Textbox');
        }
    }

    /**
     * Get current text settings
     * @returns {Object}
     */
    getSettings() {
        return {
            fontFamily: this.fontFamily,
            fontSize: this.fontSize,
            fontWeight: this.fontWeight,
            fontStyle: this.fontStyle,
            textAlign: this.textAlign,
            textColor: this.textColor,
            backgroundColor: this.backgroundColor
        };
    }

    /**
     * Get available fonts
     * @returns {string[]}
     */
    getAvailableFonts() {
        return [
            'Inter',
            'Arial',
            'Helvetica',
            'Georgia',
            'Times New Roman',
            'Courier New',
            'Verdana',
            'Impact',
            'Comic Sans MS',
            'Trebuchet MS'
        ];
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TextTool;
}
