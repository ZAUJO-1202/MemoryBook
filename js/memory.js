import { API } from './api.js';
import { Album } from './album.js';
import { generateUUID } from './utils.js';

/**
 * Gestor del modal de creación de recuerdos
 */
class MemoryManager {
    constructor() {
        this.modal = document.getElementById('memory-modal');
        this.form = document.getElementById('memory-form');
        this.fileInput = document.getElementById('memory-file');
        this.dropZone = document.getElementById('drop-zone');
        this.previewContainer = document.getElementById('file-preview-container');
        this.previewImg = document.getElementById('img-form-preview');
        this.canvas = document.getElementById('signature-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.photoBase64 = null;
        this.isDrawing = false;
    }

    init() {
        document.getElementById('btn-sidebar-add-memory').addEventListener('click', () => this.open());
        document.getElementById('btn-close-memory-modal').addEventListener('click', () => this.close());
        document.getElementById('btn-cancel-memory').addEventListener('click', () => this.close());
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        this.dropZone.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFile(e.target.files[0]));
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('drag-over');
        });
        this.dropZone.addEventListener('dragleave', () => this.dropZone.classList.remove('drag-over'));
        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files[0]) this.handleFile(e.dataTransfer.files[0]);
        });

        document.getElementById('btn-clear-canvas').addEventListener('click', () => this.clearCanvas());
        this.setupCanvasDrawing();
    }

    setupCanvasDrawing() {
        const start = (e) => {
            this.isDrawing = true;
            const pos = this.getCanvasPos(e);
            this.ctx.beginPath();
            this.ctx.moveTo(pos.x, pos.y);
        };
        const draw = (e) => {
            if (!this.isDrawing) return;
            const pos = this.getCanvasPos(e);
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
        };
        const stop = () => { this.isDrawing = false; };

        this.canvas.addEventListener('mousedown', start);
        this.canvas.addEventListener('mousemove', draw);
        this.canvas.addEventListener('mouseup', stop);
        this.canvas.addEventListener('mouseleave', stop);
        this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); start(e.touches[0]); });
        this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e.touches[0]); });
        this.canvas.addEventListener('touchend', stop);
    }

    getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    handleFile(file) {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.photoBase64 = e.target.result;
            this.previewImg.src = this.photoBase64;
            this.previewContainer.classList.remove('hidden');
            this.dropZone.querySelector('p').classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }

    open() {
        this.form.reset();
        this.photoBase64 = null;
        this.previewContainer.classList.add('hidden');
        this.dropZone.querySelector('p').classList.remove('hidden');
        this.clearCanvas();
        this.setupCanvasStyle();
        this.modal.classList.remove('hidden');
        document.getElementById('mem-date').valueAsDate = new Date();
    }

    setupCanvasStyle() {
        this.ctx.strokeStyle = '#2c2a24';
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }

    close() {
        this.modal.classList.add('hidden');
    }

    canvasHasContent() {
        const pixels = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
        for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i] > 0) return true;
        }
        return false;
    }

    autoCropCanvas() {
        const canvas = this.canvas;
        const ctx = this.ctx;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let top = canvas.height, bottom = 0, left = canvas.width, right = 0;
        
        // Find the bounding box of drawn content
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const alpha = data[(y * canvas.width + x) * 4 + 3];
                if (alpha > 0) {
                    if (x < left) left = x;
                    if (x > right) right = x;
                    if (y < top) top = y;
                    if (y > bottom) bottom = y;
                }
            }
        }
        
        // If no content, return empty
        if (top > bottom || left > right) {
            return canvas.toDataURL('image/png');
        }
        
        // Add padding
        const padding = 20;
        left = Math.max(0, left - padding);
        top = Math.max(0, top - padding);
        right = Math.min(canvas.width, right + padding);
        bottom = Math.min(canvas.height, bottom + padding);
        
        const cropWidth = right - left;
        const cropHeight = bottom - top;
        
        // Create a temporary canvas for the cropped area
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = cropWidth;
        tempCanvas.height = cropHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(canvas, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        
        return tempCanvas.toDataURL('image/png');
    }

    async handleSubmit(e) {
        e.preventDefault();

        const saveBtn = document.getElementById('btn-save-memory');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';

        try {
            // Capture caption and wrap in quotes to prevent formula interpretation in Sheets
            const caption = document.getElementById('mem-caption').value;
            const quotedCaption = `"${caption.replace(/"/g, '""')}"`;

            const payload = {
                id: generateUUID(),
                date: document.getElementById('mem-date').value,
                description: document.getElementById('mem-description').value,
                caption: quotedCaption,
                signature: '',
                rotation: 0
            };

            if (this.photoBase64) payload.photoBase64 = this.photoBase64;
            if (this.canvasHasContent()) {
                // Auto-crop the drawing before sending
                payload.drawingBase64 = this.autoCropCanvas();
            }

            const result = await API.saveMemory(payload);

            if (result.success) {
                this.close();
                await Album.reload();
                Album.goToLastPage();
                this.showToast('Recuerdo guardado correctamente', 'success');
            } else {
                this.showToast('Error al guardar: ' + (result.error || 'Desconocido'), 'error');
            }
        } catch (err) {
            this.showToast('Error de conexión al guardar', 'error');
            console.error(err);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Guardar Recuerdo';
        }
    }

    showToast(message, type = 'info') {
        const existing = document.querySelector('.toast-notification');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('visible'));
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }
}

export const MemoryModal = new MemoryManager();