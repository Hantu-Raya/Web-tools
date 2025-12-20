class ImageConverter {
    constructor() {
        this.dropZone = document.getElementById('drop-zone');
        this.fileInput = document.getElementById('file-input');
        this.imageGrid = document.getElementById('image-grid');
        this.globalControls = document.getElementById('global-controls');
        this.convertAllBtn = document.getElementById('convert-all-btn');
        this.clearAllBtn = document.getElementById('clear-all-btn');
        this.globalFormat = document.getElementById('global-format');
        this.canvas = document.getElementById('conversion-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.files = [];
        this.init();
    }

    init() {
        // Drag and drop listeners
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('dragover');
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('dragover');
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        this.dropZone.addEventListener('click', () => this.fileInput.click());

        this.fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        this.convertAllBtn.addEventListener('click', () => this.convertAll());
        this.clearAllBtn.addEventListener('click', () => this.clearAll());
        
        // Sync global format change to all cards (including completed ones for re-conversion)
        this.globalFormat.addEventListener('change', (e) => {
            const newFormat = e.target.value;
            this.files.forEach(fileObj => {
                fileObj.targetFormat = newFormat;
                // Reset status to allow re-conversion with new format
                if (fileObj.status === 'completed') {
                    fileObj.status = 'idle';
                    fileObj.resultBlob = null;
                }
                const card = document.getElementById(`card-${fileObj.id}`);
                if (card) {
                    const cardSelect = card.querySelector('.item-format');
                    if (cardSelect) cardSelect.value = newFormat;
                    const statusEl = card.querySelector('.card-status');
                    if (statusEl) {
                        statusEl.textContent = 'Ready';
                        statusEl.classList.remove('visible');
                        statusEl.style.color = '';
                    }
                }
            });
        });
    }

    // Allowed MIME types for security
    static ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    static FORMAT_EXTENSIONS = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp'
    };
    // Security limits to prevent DoS
    static MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    static MAX_DIMENSION = 16384; // Common browser canvas limit

    handleFiles(fileList) {
        Array.from(fileList).forEach(file => {
            // Security: Check file type whitelist
            if (!ImageConverter.ALLOWED_TYPES.includes(file.type)) {
                console.warn(`Rejected file ${file.name}: invalid type ${file.type}`);
                return;
            }
            // Security: Check file size limit
            if (file.size > ImageConverter.MAX_FILE_SIZE) {
                console.warn(`Rejected file ${file.name}: exceeds ${ImageConverter.MAX_FILE_SIZE / 1024 / 1024}MB limit`);
                return;
            }
            const uniqueId = 'img_' + crypto.randomUUID().slice(0, 8);
            const fileObj = {
                id: uniqueId,
                file: file,
                previewUrl: URL.createObjectURL(file),
                status: 'idle',
                targetFormat: this.globalFormat.value,
                resultBlob: null
            };
            this.files.push(fileObj);
            this.renderCard(fileObj);
        });

        if (this.files.length > 0) {
            this.globalControls.classList.remove('hidden');
        }
    }

    // Sanitize filename to prevent path traversal, XSS, and unicode tricks
    sanitizeFilename(name) {
        return name.replace(/[<>:"/\\|?*\x00-\x1f\u200B-\u200D\u202A-\u202E\uFEFF]/g, '_').trim();
    }

    getBaseName(filename) {
        const lastDot = filename.lastIndexOf('.');
        return lastDot !== -1 ? filename.substring(0, lastDot) : filename;
    }

    renderCard(fileObj) {
        const card = document.createElement('div');
        card.className = 'image-card';
        card.id = `card-${fileObj.id}`;
        
        // Build card using DOM methods to prevent XSS from filenames
        const preview = document.createElement('div');
        preview.className = 'card-preview';
        const img = document.createElement('img');
        img.src = fileObj.previewUrl;
        img.alt = 'Preview';
        preview.appendChild(img);

        const info = document.createElement('div');
        info.className = 'card-info';
        const nameDiv = document.createElement('div');
        nameDiv.className = 'name';
        nameDiv.textContent = this.sanitizeFilename(fileObj.file.name); // Safe text insertion
        const metaDiv = document.createElement('div');
        metaDiv.className = 'meta';
        metaDiv.textContent = `${(fileObj.file.size / 1024).toFixed(1)} KB | ${(fileObj.file.type.split('/')[1] || 'unknown').toUpperCase()}`;
        info.appendChild(nameDiv);
        info.appendChild(metaDiv);

        const actions = document.createElement('div');
        actions.className = 'card-actions';

        const select = document.createElement('select');
        select.className = 'item-format';
        ['image/png', 'image/jpeg', 'image/webp'].forEach(fmt => {
            const opt = document.createElement('option');
            opt.value = fmt;
            opt.textContent = fmt.split('/')[1].toUpperCase();
            if (fileObj.targetFormat === fmt) opt.selected = true;
            select.appendChild(opt);
        });

        const status = document.createElement('div');
        status.className = 'card-status';
        status.id = `status-${fileObj.id}`;
        status.textContent = 'Ready';

        const dlBtn = document.createElement('button');
        dlBtn.className = 'download-btn';
        dlBtn.id = `dl-${fileObj.id}`;
        dlBtn.disabled = true;
        dlBtn.title = 'Download';
        dlBtn.textContent = '💾';

        actions.appendChild(select);
        actions.appendChild(status);
        actions.appendChild(dlBtn);

        card.appendChild(preview);
        card.appendChild(info);
        card.appendChild(actions);

        // Local format change
        select.addEventListener('change', (e) => {
            fileObj.targetFormat = e.target.value;
            fileObj.status = 'idle';
            fileObj.resultBlob = null;
            status.classList.remove('visible');
            status.textContent = 'Ready';
            status.style.color = '';
            dlBtn.disabled = true;
        });

        // Download event - uses File System Access API when available
        dlBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (fileObj.resultBlob) {
                const baseName = this.getBaseName(this.sanitizeFilename(fileObj.file.name));
                const ext = ImageConverter.FORMAT_EXTENSIONS[fileObj.targetFormat] || 'png';
                const suggestedName = `converted_${baseName}.${ext}`;
                await this.triggerDownload(fileObj.resultBlob, suggestedName, fileObj.targetFormat);
            }
        });

        this.imageGrid.appendChild(card);
    }

    // Modern download with File System Access API fallback
    async triggerDownload(blob, suggestedName, mimeType) {
        const ext = ImageConverter.FORMAT_EXTENSIONS[mimeType] || 'png';
        
        // Try File System Access API first (works reliably on file:// protocol)
        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: suggestedName,
                    types: [{
                        description: `${ext.toUpperCase()} Image`,
                        accept: { [mimeType]: [`.${ext}`] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                return; // Success
            } catch (err) {
                if (err.name === 'AbortError') return; // User cancelled
                console.warn('File System Access failed, using fallback:', err);
            }
        }
        
        // Fallback: Blob URL with anchor click
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = suggestedName;
        document.body.appendChild(a);
        a.click();
        
        // Delayed cleanup to ensure download starts
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 5000);
    }

    async convertAll() {
        if (this.files.length === 0) return;
        
        this.convertAllBtn.disabled = true;
        this.globalFormat.disabled = true;
        this.clearAllBtn.disabled = true;

        for (const fileObj of this.files) {
            try {
                await this.convertFile(fileObj);
                
                // Trigger download after conversion
                if (fileObj.resultBlob) {
                    const baseName = this.getBaseName(this.sanitizeFilename(fileObj.file.name));
                    const ext = ImageConverter.FORMAT_EXTENSIONS[fileObj.targetFormat] || 'png';
                    const suggestedName = `converted_${baseName}.${ext}`;
                    await this.triggerDownload(fileObj.resultBlob, suggestedName, fileObj.targetFormat);
                }
            } catch (err) {
                console.error(`Error processing ${fileObj.file.name}:`, err);
            }
        }

        this.convertAllBtn.disabled = false;
        this.globalFormat.disabled = false;
        this.clearAllBtn.disabled = false;
    }

    async convertFile(fileObj) {
        const card = document.getElementById(`card-${fileObj.id}`);
        const statusEl = document.getElementById(`status-${fileObj.id}`);
        const dlBtn = document.getElementById(`dl-${fileObj.id}`);
        
        if (!card || !statusEl || !dlBtn) return;
        
        card.classList.add('converting');
        fileObj.status = 'converting';
        statusEl.textContent = 'Converting...';

        try {
            const img = await this.loadImage(fileObj.previewUrl);
            this.canvas.width = img.naturalWidth;
            this.canvas.height = img.naturalHeight;

            // Clear and handle background for JPEG (transparency -> white)
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            if (fileObj.targetFormat === 'image/jpeg') {
                this.ctx.fillStyle = '#ffffff';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            }
            
            this.ctx.drawImage(img, 0, 0);

            // Security: Check image dimensions to prevent memory exhaustion
            if (img.naturalWidth > ImageConverter.MAX_DIMENSION || img.naturalHeight > ImageConverter.MAX_DIMENSION) {
                throw new Error(`Image dimensions (${img.naturalWidth}x${img.naturalHeight}) exceed safe limit of ${ImageConverter.MAX_DIMENSION}px`);
            }

            // Use toBlob for better memory efficiency
            const blob = await new Promise((resolve, reject) => {
                this.canvas.toBlob(
                    (b) => b ? resolve(b) : reject(new Error('Blob creation failed')),
                    fileObj.targetFormat,
                    0.92
                );
            });

            fileObj.resultBlob = blob;
            fileObj.status = 'completed';
            
            card.classList.remove('converting');
            statusEl.textContent = 'Done!';
            statusEl.classList.add('visible');
            dlBtn.disabled = false;
        } catch (error) {
            console.error('Conversion failed:', error);
            card.classList.remove('converting');
            statusEl.textContent = 'Error';
            statusEl.style.color = '#ff6b6b';
            statusEl.classList.add('visible');
            fileObj.status = 'error';
        }
    }

    loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Image load failed'));
            img.src = url;
        });
    }

    clearAll() {
        // Proper memory cleanup
        this.files.forEach(f => {
            URL.revokeObjectURL(f.previewUrl);
            f.resultBlob = null;
        });
        this.files = [];
        this.imageGrid.innerHTML = '';
        this.globalControls.classList.add('hidden');
    }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    new ImageConverter();
});
