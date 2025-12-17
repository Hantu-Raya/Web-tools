/**
 * Image Cropper - Paste-to-Crop Application
 */

(function() {
    'use strict';

    // ============================================
    // DOM Element References
    // ============================================
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const editorContainer = document.getElementById('editorContainer');
    const cropperImage = document.getElementById('cropperImage');
    const previewContainer = document.getElementById('previewContainer');
    
    const btnRotateLeft = document.getElementById('btnRotateLeft');
    const btnRotateRight = document.getElementById('btnRotateRight');
    const btnFlipH = document.getElementById('btnFlipH');
    const btnFlipV = document.getElementById('btnFlipV');
    const btnReset = document.getElementById('btnReset');
    const btnNewImage = document.getElementById('btnNewImage');
    const btnDownload = document.getElementById('btnDownload');

    // ============================================
    // State
    // ============================================
    let cropper = null;
    let previewUpdateTimer = null;

    // ============================================
    // Utility Functions
    // ============================================
    
    function isValidImageFile(file) {
        if (!file || !file.type) return false;
        return file.type.startsWith('image/');
    }

    function generateFilename() {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        return `cropped-image-${timestamp}.png`;
    }

    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Updates the live preview with the current cropped area.
     * Uses requestAnimationFrame for smooth updates.
     */
    function updatePreview() {
        if (!cropper) return;
        
        // Check if there's a crop box
        const cropBoxData = cropper.getCropBoxData();
        if (!cropBoxData.width || !cropBoxData.height) {
            // No crop box yet - show placeholder message
            previewContainer.innerHTML = '<span style="color:#6b6b7b;font-size:12px;text-align:center;padding:10px;">Draw a crop box<br>to see preview</span>';
            return;
        }
        
        try {
            // Get cropped canvas with preview size
            const canvas = cropper.getCroppedCanvas({
                maxWidth: 200,
                maxHeight: 180,
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high',
                fillColor: '#fff'
            });
            
            if (canvas) {
                // Clear previous content and add new canvas
                previewContainer.innerHTML = '';
                canvas.style.maxWidth = '100%';
                canvas.style.maxHeight = '100%';
                canvas.style.borderRadius = '4px';
                previewContainer.appendChild(canvas);
            }
        } catch (e) {
            console.warn('Preview update error:', e);
        }
    }

    /**
     * Debounced preview update to avoid too many redraws.
     */
    function schedulePreviewUpdate() {
        if (previewUpdateTimer) {
            cancelAnimationFrame(previewUpdateTimer);
        }
        previewUpdateTimer = requestAnimationFrame(updatePreview);
    }

    // ============================================
    // Core Functions
    // ============================================

    function showEditor() {
        dropZone.classList.add('drop-zone--hidden');
        editorContainer.classList.add('editor-container--visible');
    }

    function showDropZone() {
        editorContainer.classList.remove('editor-container--visible');
        dropZone.classList.remove('drop-zone--hidden');
    }

    function destroyCropper() {
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        cropperImage.src = '';
        cropperImage.removeAttribute('src');
        previewContainer.innerHTML = '';
    }

    function initializeCropper(imageSrc) {
        // Clean up previous instance
        destroyCropper();
        
        // Show editor UI first
        showEditor();
        
        // Create a new image to avoid caching issues
        cropperImage.src = imageSrc;
        
        // Initialize Cropper.js after image loads
        cropperImage.onload = function() {
            console.log('Image loaded, initializing cropper...');
            
            // Check if Cropper is available
            if (typeof Cropper === 'undefined') {
                console.error('Cropper.js library not loaded!');
                alert('Error: Cropper.js library failed to load. Please check your internet connection and refresh.');
                return;
            }
            
            cropper = new Cropper(cropperImage, {
                // IMPORTANT: viewMode 0 allows free movement and rotation
                viewMode: 0,
                
                // DRAG MODE: 'crop' allows drawing new crop box by dragging
                dragMode: 'crop',
                
                // Disable initial auto crop - user will draw their own box
                autoCrop: false,
                
                // Aspect ratio (NaN = free ratio)
                aspectRatio: NaN,
                
                // Show guides and center
                guides: true,
                center: true,
                highlight: true,
                background: true,
                modal: true,
                
                // Crop box settings
                cropBoxMovable: true,
                cropBoxResizable: true,
                
                // CRITICAL: Enable these for rotation and flip to work
                rotatable: true,
                scalable: true,
                
                // Zoom settings
                zoomable: true,
                zoomOnTouch: true,
                zoomOnWheel: true,
                wheelZoomRatio: 0.1,
                
                // Double-click toggles between 'crop' and 'move'
                toggleDragModeOnDblclick: true,
                
                // Responsive
                responsive: true,
                restore: true,
                
                // Don't use built-in preview - we'll use custom one
                // preview: previewContainer,
                
                // Callbacks
                ready: function() {
                    console.log('Cropper is ready!');
                    console.log('Drag on the image to draw a crop box');
                    updatePreview(); // Initial preview state
                },
                cropstart: function(e) {
                    console.log('Crop started:', e.detail.action);
                },
                cropmove: function(e) {
                    // Update preview while dragging
                    schedulePreviewUpdate();
                },
                cropend: function(e) {
                    // Update preview when done
                    schedulePreviewUpdate();
                },
                crop: function(e) {
                    // Crop box changed - update preview
                    schedulePreviewUpdate();
                },
                zoom: function(e) {
                    // Update preview on zoom
                    schedulePreviewUpdate();
                }
            });
        };
        
        cropperImage.onerror = function() {
            console.error('Failed to load image');
            alert('Failed to load image. Please try another file.');
            resetToDropZone();
        };
    }

    async function handleImageFile(file) {
        if (!isValidImageFile(file)) {
            console.warn('Invalid image file type:', file?.type);
            alert('Please select a valid image file.');
            return;
        }

        try {
            const dataURL = await readFileAsDataURL(file);
            initializeCropper(dataURL);
        } catch (error) {
            console.error('Error loading image:', error);
            alert('Error loading image. Please try again.');
        }
    }

    function downloadCroppedImage() {
        if (!cropper) {
            alert('Please load an image first.');
            return;
        }

        // Check if there's a crop box
        const cropBoxData = cropper.getCropBoxData();
        if (!cropBoxData.width || !cropBoxData.height) {
            alert('Please draw a crop area first by dragging on the image.');
            return;
        }

        const canvas = cropper.getCroppedCanvas({
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
            fillColor: '#fff'
        });

        if (!canvas) {
            console.error('Failed to generate cropped canvas');
            alert('Failed to generate cropped image.');
            return;
        }

        canvas.toBlob((blob) => {
            if (!blob) {
                console.error('Failed to create blob');
                return;
            }

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = generateFilename();
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 'image/png', 1.0);
    }

    function resetToDropZone() {
        destroyCropper();
        showDropZone();
        fileInput.value = '';
    }

    // ============================================
    // Button Handlers
    // ============================================

    function onRotateLeft() {
        console.log('Rotate left clicked');
        if (!cropper) {
            console.warn('No cropper instance');
            return;
        }
        try {
            cropper.rotate(-90);
            schedulePreviewUpdate();
            console.log('Rotated -90 degrees');
        } catch (e) {
            console.error('Rotate error:', e);
        }
    }

    function onRotateRight() {
        console.log('Rotate right clicked');
        if (!cropper) {
            console.warn('No cropper instance');
            return;
        }
        try {
            cropper.rotate(90);
            schedulePreviewUpdate();
            console.log('Rotated 90 degrees');
        } catch (e) {
            console.error('Rotate error:', e);
        }
    }

    function onFlipHorizontal() {
        console.log('Flip horizontal clicked');
        if (!cropper) {
            console.warn('No cropper instance');
            return;
        }
        try {
            const imageData = cropper.getImageData();
            const currentScaleX = imageData.scaleX || 1;
            cropper.scaleX(-currentScaleX);
            schedulePreviewUpdate();
            console.log('Flipped horizontally, new scaleX:', -currentScaleX);
        } catch (e) {
            console.error('Flip H error:', e);
        }
    }

    function onFlipVertical() {
        console.log('Flip vertical clicked');
        if (!cropper) {
            console.warn('No cropper instance');
            return;
        }
        try {
            const imageData = cropper.getImageData();
            const currentScaleY = imageData.scaleY || 1;
            cropper.scaleY(-currentScaleY);
            schedulePreviewUpdate();
            console.log('Flipped vertically, new scaleY:', -currentScaleY);
        } catch (e) {
            console.error('Flip V error:', e);
        }
    }

    function onReset() {
        console.log('Reset clicked');
        if (!cropper) {
            console.warn('No cropper instance');
            return;
        }
        try {
            cropper.reset();
            schedulePreviewUpdate();
            console.log('Reset complete');
        } catch (e) {
            console.error('Reset error:', e);
        }
    }

    // ============================================
    // Event Handlers
    // ============================================

    function onDropZoneClick() {
        fileInput.click();
    }

    function onFileInputChange(e) {
        const file = e.target.files?.[0];
        if (file) {
            handleImageFile(file);
        }
    }

    function onPaste(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    handleImageFile(file);
                }
                return;
            }
        }
    }

    function onDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drop-zone--active');
    }

    function onDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drop-zone--active');
    }

    function onDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drop-zone--active');

        const file = e.dataTransfer?.files?.[0];
        if (file) {
            handleImageFile(file);
        }
    }

    // ============================================
    // Initialization
    // ============================================

    function init() {
        console.log('Initializing Image Cropper...');

        // Verify elements exist
        const elements = { dropZone, fileInput, editorContainer, cropperImage, previewContainer };
        for (const [name, el] of Object.entries(elements)) {
            if (!el) {
                console.error(`Missing element: ${name}`);
                return;
            }
        }

        // Drop zone events
        dropZone.addEventListener('click', onDropZoneClick);
        dropZone.addEventListener('dragover', onDragOver);
        dropZone.addEventListener('dragleave', onDragLeave);
        dropZone.addEventListener('drop', onDrop);

        // File input
        fileInput.addEventListener('change', onFileInputChange);

        // Global paste
        document.addEventListener('paste', onPaste);

        // Control buttons
        btnRotateLeft?.addEventListener('click', onRotateLeft);
        btnRotateRight?.addEventListener('click', onRotateRight);
        btnFlipH?.addEventListener('click', onFlipHorizontal);
        btnFlipV?.addEventListener('click', onFlipVertical);
        btnReset?.addEventListener('click', onReset);
        btnNewImage?.addEventListener('click', resetToDropZone);
        btnDownload?.addEventListener('click', downloadCroppedImage);

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (!cropper) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch(e.key) {
                case 'Enter':
                    e.preventDefault();
                    downloadCroppedImage();
                    break;
                case 'Escape':
                    e.preventDefault();
                    resetToDropZone();
                    break;
                case 'r':
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        onReset();
                    }
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    onRotateLeft();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    onRotateRight();
                    break;
            }
        });

        console.log('Image Cropper initialized successfully');
        console.log('Instructions:');
        console.log('1. Upload an image (click, paste, or drag)');
        console.log('2. Drag on the image to draw a crop box');
        console.log('3. Use buttons to rotate/flip');
        console.log('4. Click Download to save');
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
