/**
 * =====================================================
 * PhotoLite - Transform Tool
 * Rotate, flip, and resize operations
 * =====================================================
 */

class TransformTool {
    constructor(canvasManager, historyManager) {
        this.canvasManager = canvasManager;
        this.historyManager = historyManager;
        this.canvas = canvasManager.canvas;
        
        this.isActive = false;
    }

    /**
     * Activate transform tool
     */
    activate() {
        this.isActive = true;
        this.canvas.isDrawingMode = false;
        this.canvas.selection = true;
        
        // Enable transform controls on all objects (unless locked)
        this.canvas.getObjects().forEach(obj => {
            const isLocked = obj.isLocked === true;
            obj.set({
                hasControls: !isLocked,
                hasBorders: true,
                lockRotation: isLocked,
                lockScalingX: isLocked,
                lockScalingY: isLocked,
                selectable: !isLocked,
                evented: !isLocked
            });
        });
        
        this.canvas.requestRenderAll();
    }

    /**
     * Deactivate transform tool
     */
    deactivate() {
        this.isActive = false;
        
        // Disable transform controls (switch to selection only)
        this.canvas.getObjects().forEach(obj => {
            obj.set({
                hasControls: false, // Hide resize handles
                hasBorders: true,   // Keep selection border
                lockRotation: true,
                lockScalingX: true,
                lockScalingY: true
            });
        });
        
        this.canvas.requestRenderAll();
    }

    /**
     * Rotate active object by degrees
     * @param {number} degrees 
     */
    rotate(degrees) {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            const currentAngle = activeObject.angle || 0;
            activeObject.rotate((currentAngle + degrees) % 360);
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, `Rotate ${degrees}°`);
        }
    }

    /**
     * Rotate 90 degrees clockwise
     */
    rotate90CW() {
        this.rotate(90);
    }

    /**
     * Rotate 90 degrees counter-clockwise
     */
    rotate90CCW() {
        this.rotate(-90);
    }

    /**
     * Rotate 180 degrees
     */
    rotate180() {
        this.rotate(180);
    }

    /**
     * Flip horizontally
     */
    flipHorizontal() {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            activeObject.set('flipX', !activeObject.flipX);
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Flip Horizontal');
        }
    }

    /**
     * Flip vertically
     */
    flipVertical() {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            activeObject.set('flipY', !activeObject.flipY);
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Flip Vertical');
        }
    }

    /**
     * Scale active object
     * @param {number} scaleX 
     * @param {number} scaleY 
     */
    scale(scaleX, scaleY) {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            activeObject.set({
                scaleX: activeObject.scaleX * scaleX,
                scaleY: activeObject.scaleY * scaleY
            });
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Scale');
        }
    }

    /**
     * Scale uniformly
     * @param {number} factor 
     */
    scaleUniform(factor) {
        this.scale(factor, factor);
    }

    /**
     * Resize active object to specific dimensions
     * @param {number} width 
     * @param {number} height 
     */
    resizeTo(width, height) {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            const currentWidth = activeObject.width * activeObject.scaleX;
            const currentHeight = activeObject.height * activeObject.scaleY;
            
            activeObject.set({
                scaleX: width / activeObject.width,
                scaleY: height / activeObject.height
            });
            
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Resize');
        }
    }

    /**
     * Fit object to canvas
     */
    fitToCanvas() {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            const canvasWidth = this.canvasManager.width;
            const canvasHeight = this.canvasManager.height;
            const objWidth = activeObject.width;
            const objHeight = activeObject.height;
            
            const scaleX = canvasWidth / objWidth;
            const scaleY = canvasHeight / objHeight;
            const scale = Math.min(scaleX, scaleY);
            
            activeObject.set({
                scaleX: scale,
                scaleY: scale,
                left: (canvasWidth - objWidth * scale) / 2,
                top: (canvasHeight - objHeight * scale) / 2
            });
            
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Fit to Canvas');
        }
    }

    /**
     * Center object horizontally
     */
    centerHorizontally() {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            const canvasWidth = this.canvasManager.width;
            const objWidth = activeObject.width * activeObject.scaleX;
            
            activeObject.set('left', (canvasWidth - objWidth) / 2);
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Center Horizontally');
        }
    }

    /**
     * Center object vertically
     */
    centerVertically() {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            const canvasHeight = this.canvasManager.height;
            const objHeight = activeObject.height * activeObject.scaleY;
            
            activeObject.set('top', (canvasHeight - objHeight) / 2);
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Center Vertically');
        }
    }

    /**
     * Center object both ways
     */
    centerBoth() {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            activeObject.center();
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Center');
        }
    }

    /**
     * Align to edge
     * @param {string} edge - 'left', 'right', 'top', 'bottom'
     */
    alignTo(edge) {
        const activeObject = this.canvas.getActiveObject();
        if (!activeObject) return;

        const canvasWidth = this.canvasManager.width;
        const canvasHeight = this.canvasManager.height;
        const objWidth = activeObject.width * activeObject.scaleX;
        const objHeight = activeObject.height * activeObject.scaleY;

        switch (edge) {
            case 'left':
                activeObject.set('left', 0);
                break;
            case 'right':
                activeObject.set('left', canvasWidth - objWidth);
                break;
            case 'top':
                activeObject.set('top', 0);
                break;
            case 'bottom':
                activeObject.set('top', canvasHeight - objHeight);
                break;
        }

        this.canvas.requestRenderAll();
        this.historyManager.saveState(this.canvas, `Align ${edge}`);
    }

    /**
     * Skew object
     * @param {number} skewX 
     * @param {number} skewY 
     */
    skew(skewX, skewY) {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            activeObject.set({
                skewX: skewX,
                skewY: skewY
            });
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Skew');
        }
    }

    /**
     * Reset all transformations
     */
    resetTransformations() {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            activeObject.set({
                scaleX: 1,
                scaleY: 1,
                angle: 0,
                skewX: 0,
                skewY: 0,
                flipX: false,
                flipY: false
            });
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Reset Transform');
        }
    }

    /**
     * Resize entire canvas
     * @param {number} width 
     * @param {number} height 
     * @param {string} anchor - 'center', 'top-left', etc.
     */
    resizeCanvas(width, height, anchor = 'center') {
        const oldWidth = this.canvasManager.width;
        const oldHeight = this.canvasManager.height;
        
        // Calculate offset based on anchor
        let offsetX = 0;
        let offsetY = 0;
        
        switch (anchor) {
            case 'center':
                offsetX = (width - oldWidth) / 2;
                offsetY = (height - oldHeight) / 2;
                break;
            case 'top-left':
                offsetX = 0;
                offsetY = 0;
                break;
            case 'top-right':
                offsetX = width - oldWidth;
                offsetY = 0;
                break;
            case 'bottom-left':
                offsetX = 0;
                offsetY = height - oldHeight;
                break;
            case 'bottom-right':
                offsetX = width - oldWidth;
                offsetY = height - oldHeight;
                break;
        }

        // Move all objects to maintain relative position
        this.canvas.getObjects().forEach(obj => {
            obj.set({
                left: obj.left + offsetX,
                top: obj.top + offsetY
            });
        });

        // Resize canvas
        this.canvasManager.resize(width, height);
        this.canvas.requestRenderAll();
        this.historyManager.saveState(this.canvas, 'Resize Canvas');
    }

    /**
     * Rotate entire canvas (all objects)
     * @param {number} degrees 
     */
    rotateCanvas(degrees) {
        const centerX = this.canvasManager.width / 2;
        const centerY = this.canvasManager.height / 2;
        const radians = fabric.util.degreesToRadians(degrees);

        this.canvas.getObjects().forEach(obj => {
            const objCenterX = obj.left + (obj.width * obj.scaleX) / 2;
            const objCenterY = obj.top + (obj.height * obj.scaleY) / 2;
            
            // Rotate point around canvas center
            const dx = objCenterX - centerX;
            const dy = objCenterY - centerY;
            
            const newX = centerX + dx * Math.cos(radians) - dy * Math.sin(radians);
            const newY = centerY + dx * Math.sin(radians) + dy * Math.cos(radians);
            
            obj.set({
                left: newX - (obj.width * obj.scaleX) / 2,
                top: newY - (obj.height * obj.scaleY) / 2,
                angle: (obj.angle || 0) + degrees
            });
        });

        // Swap canvas dimensions for 90° rotations
        if (degrees === 90 || degrees === -90 || degrees === 270) {
            const oldWidth = this.canvasManager.width;
            const oldHeight = this.canvasManager.height;
            this.canvasManager.resize(oldHeight, oldWidth);
        }

        this.canvas.requestRenderAll();
        this.historyManager.saveState(this.canvas, 'Rotate Canvas');
    }

    /**
     * Get object dimensions
     * @returns {Object|null}
     */
    getObjectDimensions() {
        const activeObject = this.canvas.getActiveObject();
        if (!activeObject) return null;

        return {
            width: Math.round(activeObject.width * activeObject.scaleX),
            height: Math.round(activeObject.height * activeObject.scaleY),
            left: Math.round(activeObject.left),
            top: Math.round(activeObject.top),
            angle: Math.round(activeObject.angle || 0),
            scaleX: activeObject.scaleX,
            scaleY: activeObject.scaleY
        };
    }

    /**
     * Bring object to front
     */
    bringToFront() {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            this.canvas.bringObjectToFront(activeObject);
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Bring to Front');
        }
    }

    /**
     * Send object to back
     */
    sendToBack() {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            this.canvas.sendObjectToBack(activeObject);
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Send to Back');
        }
    }

    /**
     * Bring object forward one level
     */
    bringForward() {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            this.canvas.bringObjectForward(activeObject);
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Bring Forward');
        }
    }

    /**
     * Send object backward one level
     */
    sendBackward() {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            this.canvas.sendObjectBackwards(activeObject);
            this.canvas.requestRenderAll();
            this.historyManager.saveState(this.canvas, 'Send Backward');
        }
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TransformTool;
}
