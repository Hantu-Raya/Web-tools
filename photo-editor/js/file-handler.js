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
        
        // Magic bytes for file type validation (first bytes of each format)
        this._magicBytes = {
            'image/jpeg': [[0xFF, 0xD8, 0xFF]],
            'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
            'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]], // GIF87a, GIF89a
            'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header (WebP starts with RIFF)
            'image/bmp': [[0x42, 0x4D]] // BM
        };

        this._initEventListeners();
    }

    /**
     * Initialize event listeners
     * @private
     */
    _initEventListeners() {
        const fileInput = document.getElementById('file-input');
        const addImageInput = document.getElementById('add-image-input');
        const dropZone = document.getElementById('drop-zone');
        const openBtn = document.getElementById('btn-open');
        const saveBtn = document.getElementById('btn-save');
        const exportBtn = document.getElementById('btn-export');
        const newBtn = document.getElementById('btn-new');
        const addImageBtn = document.getElementById('btn-add-image');

        // File input change
        fileInput?.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.loadFile(e.target.files[0]);
            }
        });

        // Add image input change (for adding layers)
        addImageInput?.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.addImageFile(e.target.files[0]);
                e.target.value = ''; // Reset input for re-selection
            }
        });

        // Open button
        openBtn?.addEventListener('click', () => {
            fileInput?.click();
        });

        // Add Image button (add as layer)
        addImageBtn?.addEventListener('click', () => {
            addImageInput?.click();
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
            // Validate and clamp numeric inputs
            const rawWidth = parseInt(document.getElementById('new-width')?.value) || 1920;
            const rawHeight = parseInt(document.getElementById('new-height')?.value) || 1080;
            const width = Math.min(8000, Math.max(1, rawWidth));
            const height = Math.min(8000, Math.max(1, rawHeight));
            
            // Check combined pixel limit to prevent memory exhaustion
            const MAX_PIXELS = 25_000_000; // 25 megapixels
            if (width * height > MAX_PIXELS) {
                this._showError(`Canvas size too large. Maximum ${MAX_PIXELS.toLocaleString()} total pixels (e.g., 5000×5000).`);
                return;
            }
            
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
        // Validate file type (MIME)
        if (!this.supportedFormats.includes(file.type)) {
            this._showError('Unsupported file format. Please use JPEG, PNG, GIF, WebP, or BMP.');
            return;
        }

        // Validate file size
        if (file.size > this.maxFileSize) {
            this._showError('File too large. Maximum size is 50MB.');
            return;
        }

        // Validate magic bytes (content matches declared type)
        const validMagic = await this._validateMagicBytes(file);
        if (!validMagic) {
            this._showError('File content does not match declared type. The file may be corrupted or mislabeled.');
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
            this._showError('Failed to load image. Please try a different file.');
        }
    }

    /**
     * Add image file as a new layer (does NOT replace existing content)
     * @param {File} file
     */
    async addImageFile(file) {
        // Validate file type (MIME)
        if (!this.supportedFormats.includes(file.type)) {
            this._showError('Unsupported file format. Please use JPEG, PNG, GIF, WebP, or BMP.');
            return;
        }

        // Validate file size
        if (file.size > this.maxFileSize) {
            this._showError('File too large. Maximum size is 50MB.');
            return;
        }

        // Validate magic bytes
        const validMagic = await this._validateMagicBytes(file);
        if (!validMagic) {
            this._showError('File content does not match declared type.');
            return;
        }

        try {
            const dataURL = await this._readFileAsDataURL(file);
            await this.canvasManager.addImage(dataURL);
            
            // Save state
            this.historyManager.saveState(this.canvas, 'Add Image Layer');
            this._showSuccess('Image layer added');
        } catch (error) {
            this._showError('Failed to add image layer. Please try a different file.');
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
     * Validate file magic bytes to ensure file content matches declared type
     * @param {File} file - The file to validate
     * @returns {Promise<boolean>} - True if magic bytes match
     * @private
     */
    async _validateMagicBytes(file) {
        const signatures = this._magicBytes[file.type];
        if (!signatures) {
            // Unknown type, allow MIME-based validation to handle
            return true;
        }

        // Read first 12 bytes (enough for all our signatures)
        const headerSize = 12;
        const headerBlob = file.slice(0, headerSize);
        
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const bytes = new Uint8Array(e.target?.result);
                
                // Check if any signature matches
                const matches = signatures.some(signature => {
                    if (bytes.length < signature.length) return false;
                    return signature.every((byte, i) => bytes[i] === byte);
                });
                
                resolve(matches);
            };
            reader.onerror = () => resolve(false);
            reader.readAsArrayBuffer(headerBlob);
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
        
        // Sanitize filename for file system safety
        const safeFilename = this._sanitizeFilename(filename) || 'photolite-export';
        
        // Create download link
        const link = document.createElement('a');
        link.download = `${safeFilename}.${format}`;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Sanitize filename for file system safety
     * @param {string} filename - Raw filename input
     * @returns {string} - Safe filename
     * @private
     */
    _sanitizeFilename(filename) {
        if (!filename || typeof filename !== 'string') {
            return '';
        }
        let s = filename
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')  // Remove invalid chars
            .replace(/^\.+/, '')                      // No leading dots
            .replace(/\s+/g, '_')                     // Replace spaces with underscores
            .substring(0, 200)                        // Limit length
            .trim();

        // Remove trailing dots (Windows file system safety)
        s = s.replace(/\.+$/, '');

        // Check for Windows reserved filenames (CON, PRN, AUX, NUL, COM1-9, LPT1-9), optionally with extension
        if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i.test(s)) {
            s = '_' + s;
        }

        return s;
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
     * Show error message using toast notification
     * @param {string} message - Error message to display
     * @private
     */
    _showError(message) {
        console.error(message);
        this._showToast(message, 'error');
    }

    /**
     * Show success message using toast notification
     * @param {string} message - Success message to display
     * @private
     */
    _showSuccess(message) {
        this._showToast(message, 'success');
    }

    /**
     * Show toast notification
     * @param {string} message - Message to display
     * @param {string} type - Toast type: 'error', 'success', 'warning', 'info'
     * @param {number} duration - Duration in ms (default 4000)
     * @private
     */
    _showToast(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toast-container');
        if (!container) {
            // Fallback to alert if container doesn't exist
            alert(message);
            return;
        }

        // Validate type parameter (defense-in-depth)
        const validTypes = ['error', 'success', 'warning', 'info'];
        const safeType = validTypes.includes(type) ? type : 'info';

        // Icon SVGs for each type
        const icons = {
            error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>`,
            success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>`,
            warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>`,
            info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>`
        };

        const titles = {
            error: 'Error',
            success: 'Success',
            warning: 'Warning',
            info: 'Info'
        };

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast--${safeType}`;
        toast.innerHTML = `
            <div class="toast__icon">${icons[safeType]}</div>
            <div class="toast__content">
                <span class="toast__title">${titles[safeType]}</span>
                <span class="toast__message">${this._escapeHtml(message)}</span>
            </div>
            <button class="toast__close" aria-label="Close">&times;</button>
        `;

        // Add close button handler
        const closeBtn = toast.querySelector('.toast__close');
        closeBtn?.addEventListener('click', () => this._removeToast(toast));

        // Add to container
        container.appendChild(toast);

        // Auto-remove after duration
        setTimeout(() => this._removeToast(toast), duration);
    }

    /**
     * Remove toast with animation
     * @param {HTMLElement} toast - Toast element to remove
     * @private
     */
    _removeToast(toast) {
        if (!toast || toast.classList.contains('toast-out')) return;
        
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 250);
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     * @private
     */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Load image from URL
     * @param {string} url 
     */
    async loadFromURL(url) {
        // Validate URL scheme for security
        const allowedSchemes = ['https:', 'http:', 'data:', 'blob:'];
        try {
            const parsed = new URL(url);
            if (!allowedSchemes.includes(parsed.protocol)) {
                this._showError('Invalid URL scheme. Only HTTP, HTTPS, and data URLs are allowed.');
                return;
            }
        } catch (e) {
            this._showError('Invalid URL format.');
            return;
        }

        try {
            await this.canvasManager.loadImage(url);
            document.getElementById('drop-zone')?.classList.add('hidden');
            this.historyManager.saveState(this.canvas, 'Load from URL');
            this._updateDimensionsDisplay();
        } catch (error) {
            this._showError('Failed to load image. Please check the URL and try again.');
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
            this._showError('Failed to copy to clipboard. Please try again.');
        }
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileHandler;
}
