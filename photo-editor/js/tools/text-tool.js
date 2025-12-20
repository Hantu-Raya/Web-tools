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

    /**
     * Toggle strikethrough
     */
    toggleStrikethrough() {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox')) {
            activeObject.set('linethrough', !activeObject.linethrough);
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Toggle Strikethrough');
        }
    }

    /**
     * Set stroke (outline) on text
     * @param {string} color - Stroke color
     * @param {number} width - Stroke width
     */
    setStroke(color, width) {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox')) {
            activeObject.set({
                stroke: width > 0 ? color : null,
                strokeWidth: width
            });
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Change Text Stroke');
        }
    }

    /**
     * Set text shadow
     * @param {string} color - Shadow color
     * @param {number} blur - Blur radius
     * @param {number} offsetX - X offset
     * @param {number} offsetY - Y offset
     */
    setShadow(color, blur, offsetX, offsetY) {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox')) {
            if (blur > 0 || offsetX !== 0 || offsetY !== 0) {
                activeObject.set('shadow', new fabric.Shadow({
                    color: color,
                    blur: blur,
                    offsetX: offsetX,
                    offsetY: offsetY
                }));
            } else {
                activeObject.set('shadow', null);
            }
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Change Text Shadow');
        }
    }

    /**
     * Set text opacity
     * @param {number} opacity - 0 to 1
     */
    setOpacity(opacity) {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox')) {
            activeObject.set('opacity', opacity);
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Change Text Opacity');
        }
    }

    /**
     * Show text properties panel
     */
    showTextPanel() {
        const panel = document.getElementById('text-panel');
        if (panel) {
            panel.style.display = 'block';
            // Auto-expand when showing (remove collapsed state)
            panel.classList.remove('collapsed');
        }
    }

    /**
     * Hide text properties panel
     */
    hideTextPanel() {
        const panel = document.getElementById('text-panel');
        if (panel) {
            panel.style.display = 'none';
        }
    }

    /**
     * Sync text panel UI with selected text object
     * @param {fabric.Object} textObj - The selected text object
     */
    syncPanelToSelection(textObj) {
        if (!textObj) return;

        // Font family
        const fontSelect = document.getElementById('text-font-family');
        if (fontSelect) fontSelect.value = textObj.fontFamily || 'Inter';

        // Font size
        const sizeSlider = document.getElementById('text-font-size-slider');
        const sizeInput = document.getElementById('text-font-size');
        const size = textObj.fontSize || 32;
        if (sizeSlider) sizeSlider.value = size;
        if (sizeInput) sizeInput.value = size;

        // Style toggles
        const boldBtn = document.getElementById('text-bold');
        const italicBtn = document.getElementById('text-italic');
        const underlineBtn = document.getElementById('text-underline');
        const strikeBtn = document.getElementById('text-strikethrough');
        
        if (boldBtn) boldBtn.classList.toggle('active', textObj.fontWeight === 'bold');
        if (italicBtn) italicBtn.classList.toggle('active', textObj.fontStyle === 'italic');
        if (underlineBtn) underlineBtn.classList.toggle('active', textObj.underline === true);
        if (strikeBtn) strikeBtn.classList.toggle('active', textObj.linethrough === true);

        // Alignment
        const alignBtns = document.querySelectorAll('.align-btn');
        alignBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.align === (textObj.textAlign || 'left'));
        });

        // Fill color
        const fillInput = document.getElementById('text-fill-color');
        if (fillInput) fillInput.value = textObj.fill || '#ffffff';

        // Stroke
        const strokeColorInput = document.getElementById('text-stroke-color');
        const strokeWidthInput = document.getElementById('text-stroke-width');
        if (strokeColorInput) strokeColorInput.value = textObj.stroke || '#000000';
        if (strokeWidthInput) strokeWidthInput.value = textObj.strokeWidth || 0;

        // Shadow
        const shadow = textObj.shadow;
        const shadowColorInput = document.getElementById('text-shadow-color');
        const shadowBlurInput = document.getElementById('text-shadow-blur');
        const shadowXInput = document.getElementById('text-shadow-x');
        const shadowYInput = document.getElementById('text-shadow-y');
        if (shadowColorInput) shadowColorInput.value = shadow?.color || '#000000';
        if (shadowBlurInput) shadowBlurInput.value = shadow?.blur || 0;
        if (shadowXInput) shadowXInput.value = shadow?.offsetX || 2;
        if (shadowYInput) shadowYInput.value = shadow?.offsetY || 2;

        // Line height
        const lineHeightSlider = document.getElementById('text-line-height');
        const lineHeightValue = document.getElementById('text-line-height-value');
        const lh = textObj.lineHeight || 1.2;
        if (lineHeightSlider) lineHeightSlider.value = lh;
        if (lineHeightValue) lineHeightValue.textContent = lh.toFixed(1);

        // Letter spacing
        const spacingSlider = document.getElementById('text-letter-spacing');
        const spacingValue = document.getElementById('text-letter-spacing-value');
        const cs = textObj.charSpacing || 0;
        if (spacingSlider) spacingSlider.value = cs;
        if (spacingValue) spacingValue.textContent = cs;

        // Opacity
        const opacitySlider = document.getElementById('text-opacity');
        const opacityValue = document.getElementById('text-opacity-value');
        const op = Math.round((textObj.opacity || 1) * 100);
        if (opacitySlider) opacitySlider.value = op;
        if (opacityValue) opacityValue.textContent = op + '%';
    }

    /**
     * Initialize text panel event listeners
     */
    initTextPanelListeners() {
        // Font family
        document.getElementById('text-font-family')?.addEventListener('change', (e) => {
            this.setFontFamily(e.target.value);
        });

        // Font size slider
        const sizeSlider = document.getElementById('text-font-size-slider');
        const sizeInput = document.getElementById('text-font-size');
        sizeSlider?.addEventListener('input', (e) => {
            const size = parseInt(e.target.value);
            if (sizeInput) sizeInput.value = size;
            this.setFontSize(size);
        });
        sizeInput?.addEventListener('change', (e) => {
            const size = parseInt(e.target.value) || 32;
            if (sizeSlider) sizeSlider.value = size;
            this.setFontSize(size);
        });

        // Style toggles
        document.getElementById('text-bold')?.addEventListener('click', () => this.toggleBold());
        document.getElementById('text-italic')?.addEventListener('click', () => this.toggleItalic());
        document.getElementById('text-underline')?.addEventListener('click', () => this.toggleUnderline());
        document.getElementById('text-strikethrough')?.addEventListener('click', () => this.toggleStrikethrough());

        // Alignment buttons
        document.querySelectorAll('.align-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setTextAlign(btn.dataset.align);
                document.querySelectorAll('.align-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Fill color
        document.getElementById('text-fill-color')?.addEventListener('input', (e) => {
            this.setTextColor(e.target.value);
        });

        // Stroke
        const strokeColorInput = document.getElementById('text-stroke-color');
        const strokeWidthInput = document.getElementById('text-stroke-width');
        const updateStroke = () => {
            const color = strokeColorInput?.value || '#000000';
            const width = parseInt(strokeWidthInput?.value) || 0;
            this.setStroke(color, width);
        };
        strokeColorInput?.addEventListener('input', updateStroke);
        strokeWidthInput?.addEventListener('change', updateStroke);

        // Shadow
        const shadowInputs = ['text-shadow-color', 'text-shadow-blur', 'text-shadow-x', 'text-shadow-y'];
        const updateShadow = () => {
            const color = document.getElementById('text-shadow-color')?.value || '#000000';
            const blur = parseInt(document.getElementById('text-shadow-blur')?.value) || 0;
            const x = parseInt(document.getElementById('text-shadow-x')?.value) || 2;
            const y = parseInt(document.getElementById('text-shadow-y')?.value) || 2;
            this.setShadow(color, blur, x, y);
        };
        shadowInputs.forEach(id => {
            document.getElementById(id)?.addEventListener('change', updateShadow);
        });

        // Line height
        const lineHeightSlider = document.getElementById('text-line-height');
        const lineHeightValue = document.getElementById('text-line-height-value');
        lineHeightSlider?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (lineHeightValue) lineHeightValue.textContent = val.toFixed(1);
            this.setLineHeight(val);
        });

        // Letter spacing
        const spacingSlider = document.getElementById('text-letter-spacing');
        const spacingValue = document.getElementById('text-letter-spacing-value');
        spacingSlider?.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            if (spacingValue) spacingValue.textContent = val;
            this.setCharSpacing(val);
        });

        // Opacity
        const opacitySlider = document.getElementById('text-opacity');
        const opacityValue = document.getElementById('text-opacity-value');
        opacitySlider?.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            if (opacityValue) opacityValue.textContent = val + '%';
            this.setOpacity(val / 100);
        });
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TextTool;
}
