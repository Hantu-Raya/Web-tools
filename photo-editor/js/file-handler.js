/**
 * =====================================================
 * PhotoLite - File Handler
 * Import/Export operations for images
 * =====================================================
 */

class FileHandler {
    constructor(canvasManager, historyManager) {
        this.canvasManager = canvasManager;
        this.historyManager = historyManager;
        this.canvas = canvasManager.canvas;
        
        this.supportedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
        this.maxFileSize = 50 * 1024 * 1024; // 50MB

        this._initEventListeners();
    }

    /**
     * Initialize event listeners
     * @private
     */
    _initEventListeners() {
        const fileInput = document.getElementById('file-input');
        const dropZone = document.getElementById('drop-zone');
        const openBtn = document.getElementById('btn-open');
        const saveBtn = document.getElementById('btn-save');
        const exportBtn = document.getElementById('btn-export');
        const newBtn = document.getElementById('btn-new');

        // File input change
        fileInput?.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.loadFile(e.target.files[0]);
            }
        });

        // Open button
        openBtn?.addEventListener('click', () => {
            fileInput?.click();
        });

        // Save button (quick save as PNG)
        saveBtn?.addEventListener('click', () => {
            this.quickSave();
        });

        // Export button (opens modal)
        exportBtn?.addEventListener('click', () => {
            this.showExportModal();
        });

        // New button
        newBtn?.addEventListener('click', () => {
            this.showNewCanvasModal();
        });

        // Drop zone events (canvas area)
        if (dropZone) {
            dropZone.addEventListener('click', () => {
                fileInput?.click();
            });
        }

        // Global drag & drop events (entire page)
        this._initGlobalDragDrop();

        // Export modal events
        this._initExportModal();
        this._initNewCanvasModal();

        // Keyboard shortcut for save
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.quickSave();
            }
        });
    }

    /**
     * Initialize global drag & drop for entire page
     * @private
     */
    _initGlobalDragDrop() {
        const overlay = document.getElementById('global-drop-overlay');
        let dragCounter = 0; // Track nested drag events

        // Prevent default browser behavior for all drag events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.body.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // Drag enter - show overlay
        document.body.addEventListener('dragenter', (e) => {
            dragCounter++;
            
            // Check if dragging files
            if (e.dataTransfer?.types?.includes('Files')) {
                document.body.classList.add('drag-active');
                overlay?.classList.add('active');
            }
        });

        // Drag over - keep overlay visible
        document.body.addEventListener('dragover', (e) => {
            if (e.dataTransfer?.types?.includes('Files')) {
                e.dataTransfer.dropEffect = 'copy';
            }
        });

        // Drag leave - hide overlay when leaving page
        document.body.addEventListener('dragleave', (e) => {
            dragCounter--;
            
            // Only hide when truly leaving the page
            if (dragCounter === 0) {
                document.body.classList.remove('drag-active');
                overlay?.classList.remove('active');
            }
        });

        // Drop - handle file
        document.body.addEventListener('drop', (e) => {
            dragCounter = 0;
            document.body.classList.remove('drag-active');
            overlay?.classList.remove('active');

            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                // Load the first file
                this.loadFile(files[0]);
            }
        });

        // Also handle paste from clipboard
        document.addEventListener('paste', async (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) {
                        await this.loadFile(file);
                    }
                    return;
                }
            }
        });
    }

    /**
     * Initialize export modal
     * @private
     */
    _initExportModal() {
        const modal = document.getElementById('export-modal');
        const closeBtn = document.getElementById('modal-close');
        const cancelBtn = document.getElementById('btn-cancel-export');
        const confirmBtn = document.getElementById('btn-confirm-export');
        const formatSelect = document.getElementById('export-format');
        const qualitySlider = document.getElementById('export-quality');
        const qualityValue = document.getElementById('quality-value');
        const qualityOption = document.getElementById('quality-option');

        closeBtn?.addEventListener('click', () => this.hideExportModal());
        cancelBtn?.addEventListener('click', () => this.hideExportModal());
        
        confirmBtn?.addEventListener('click', () => {
            const format = formatSelect?.value || 'png';
            const quality = parseInt(qualitySlider?.value || '90');
            const filename = document.getElementById('export-filename')?.value || 'photolite-export';
            
            this.exportImage(format, quality, filename);
            this.hideExportModal();
        });

        // Toggle quality option visibility based on format
        formatSelect?.addEventListener('change', () => {
            if (qualityOption) {
                qualityOption.style.display = formatSelect.value === 'png' ? 'none' : 'flex';
            }
        });

        // Update quality value display
        qualitySlider?.addEventListener('input', () => {
            if (qualityValue) {
                qualityValue.textContent = `${qualitySlider.value}%`;
            }
        });

        // Close on overlay click
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideExportModal();
            }
        });
    }

    /**
     * Initialize new canvas modal
     * @private
     */
    _initNewCanvasModal() {
        const modal = document.getElementById('new-canvas-modal');
        const closeBtn = document.getElementById('new-modal-close');
        const cancelBtn = document.getElementById('btn-cancel-new');
        const confirmBtn = document.getElementById('btn-confirm-new');
        const bgSelect = document.getElementById('new-background');
        const customBgOption = document.getElementById('custom-bg-option');

        closeBtn?.addEventListener('click', () => this.hideNewCanvasModal());
        cancelBtn?.addEventListener('click', () => this.hideNewCanvasModal());

        confirmBtn?.addEventListener('click', () => {
            const width = parseInt(document.getElementById('new-width')?.value || '1920');
            const height = parseInt(document.getElementById('new-height')?.value || '1080');
            const bgType = bgSelect?.value || 'white';
            let bgColor = '#ffffff';

            switch (bgType) {
                case 'white': bgColor = '#ffffff'; break;
                case 'black': bgColor = '#000000'; break;
                case 'transparent': bgColor = 'transparent'; break;
                case 'custom': bgColor = document.getElementById('new-bg-color')?.value || '#ffffff'; break;
            }

            this.createNewCanvas(width, height, bgColor);
            this.hideNewCanvasModal();
        });

        // Toggle custom color option
        bgSelect?.addEventListener('change', () => {
            if (customBgOption) {
                customBgOption.style.display = bgSelect.value === 'custom' ? 'flex' : 'none';
            }
        });

        // Close on overlay click
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideNewCanvasModal();
            }
        });
    }

    /**
     * Load file from input
     * @param {File} file 
     */
    async loadFile(file) {
        // Validate file type
        if (!this.supportedFormats.includes(file.type)) {
            this._showError('Unsupported file format. Please use JPEG, PNG, GIF, WebP, or BMP.');
            return;
        }

        // Validate file size
        if (file.size > this.maxFileSize) {
            this._showError('File too large. Maximum size is 50MB.');
            return;
        }

        try {
            const dataURL = await this._readFileAsDataURL(file);
            await this.canvasManager.loadImage(dataURL);
            
            // Hide drop zone
            document.getElementById('drop-zone')?.classList.add('hidden');
            
            // Save initial state
            this.historyManager.saveState(this.canvas, 'Open Image');
            
            // Update dimensions display
            this._updateDimensionsDisplay();
        } catch (error) {
            this._showError('Failed to load image: ' + error.message);
        }
    }

    /**
     * Read file as data URL
     * @private
     */
    _readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Quick save as PNG
     */
    quickSave() {
        this.exportImage('png', 100, 'photolite-image');
    }

    /**
     * Export image with options
     * @param {string} format - 'png', 'jpeg', or 'webp'
     * @param {number} quality - 1-100
     * @param {string} filename - Output filename (without extension)
     */
    exportImage(format, quality, filename) {
        const dataURL = this.canvasManager.exportAsDataURL({ format, quality });
        
        // Create download link
        const link = document.createElement('a');
        link.download = `${filename}.${format}`;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Create new blank canvas
     */
    createNewCanvas(width, height, backgroundColor) {
        this.canvasManager.createNew(width, height, backgroundColor);
        document.getElementById('drop-zone')?.classList.add('hidden');
        this.historyManager.clear();
        this.historyManager.saveState(this.canvas, 'New Canvas');
        this._updateDimensionsDisplay();
    }

    /**
     * Show export modal
     */
    showExportModal() {
        document.getElementById('export-modal')?.classList.add('active');
    }

    /**
     * Hide export modal
     */
    hideExportModal() {
        document.getElementById('export-modal')?.classList.remove('active');
    }

    /**
     * Show new canvas modal
     */
    showNewCanvasModal() {
        document.getElementById('new-canvas-modal')?.classList.add('active');
    }

    /**
     * Hide new canvas modal
     */
    hideNewCanvasModal() {
        document.getElementById('new-canvas-modal')?.classList.remove('active');
    }

    /**
     * Update dimensions display
     * @private
     */
    _updateDimensionsDisplay() {
        const display = document.getElementById('image-dimensions');
        if (display) {
            display.textContent = `${this.canvasManager.width} × ${this.canvasManager.height}`;
        }
    }

    /**
     * Show error message
     * @private
     */
    _showError(message) {
        // Simple alert for now - could be replaced with toast notification
        console.error(message);
        alert(message);
    }

    /**
     * Load image from URL
     * @param {string} url 
     */
    async loadFromURL(url) {
        try {
            await this.canvasManager.loadImage(url);
            document.getElementById('drop-zone')?.classList.add('hidden');
            this.historyManager.saveState(this.canvas, 'Load from URL');
            this._updateDimensionsDisplay();
        } catch (error) {
            this._showError('Failed to load image from URL: ' + error.message);
        }
    }

    /**
     * Paste image from clipboard
     */
    async pasteFromClipboard() {
        try {
            const clipboardItems = await navigator.clipboard.read();
            
            for (const item of clipboardItems) {
                for (const type of item.types) {
                    if (type.startsWith('image/')) {
                        const blob = await item.getType(type);
                        const dataURL = await this._readFileAsDataURL(blob);
                        await this.canvasManager.loadImage(dataURL);
                        document.getElementById('drop-zone')?.classList.add('hidden');
                        this.historyManager.saveState(this.canvas, 'Paste Image');
                        this._updateDimensionsDisplay();
                        return;
                    }
                }
            }
        } catch (error) {
            console.log('Clipboard paste not available:', error.message);
        }
    }

    /**
     * Copy canvas to clipboard
     */
    async copyToClipboard() {
        try {
            const dataURL = this.canvasManager.exportAsDataURL({ format: 'png' });
            const response = await fetch(dataURL);
            const blob = await response.blob();
            
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
        } catch (error) {
            this._showError('Failed to copy to clipboard: ' + error.message);
        }
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileHandler;
}
