import { optimizeDriveUrl } from './utils.js';

/**
 * Componente UI Polaroid con Flip 3D Mecánico
 * Soporta rotación y escala interactiva
 */
export class PhotoCard {
    constructor(memoryData) {
        this.data = memoryData;
    }

    render() {
        const container = document.createElement('div');
        container.className = 'photocard-container';
        container.id = `card-${this.data.id}`;

        const inner = document.createElement('div');
        inner.className = 'photocard-inner';

        // Estructura Frontal (Polaroid Clásica)
        const front = document.createElement('div');
        front.className = 'card-front';
        front.innerHTML = `
            <div class="polaroid-img-holder">
                ${this.data.photo
                    ? `<img src="${optimizeDriveUrl(this.data.photo)}" alt="Memoria" loading="lazy">`
                    : '<div class="polaroid-placeholder">📷</div>'}
            </div>
            <div class="polaroid-meta">
                <span class="polaroid-date">${this.formatDate(this.data.date)}</span>
                <p class="polaroid-caption">${this.escapeCaption(this.data.caption || '')}</p>
            </div>
        `;

        // Estructura Posterior (Detalles, Notas, Firmas/Dibujos)
        const back = document.createElement('div');
        back.className = 'card-back';
        
        const content = document.createElement('div');
        content.className = 'card-back-content';
        content.innerText = this.data.description || '';

        back.appendChild(content);

        const drawingUrl = this.data.drawing || this.data.signature;
        if (drawingUrl) {
            const sigImg = document.createElement('img');
            sigImg.className = 'card-back-signature';
            sigImg.src = optimizeDriveUrl(drawingUrl);
            sigImg.crossOrigin = 'anonymous';
            // Center the signature inside the card back
            sigImg.style.objectFit = 'contain';
            sigImg.style.display = 'block';
            sigImg.style.margin = '0 auto';
            sigImg.style.maxWidth = '90%';
            sigImg.style.maxHeight = '80px';
            back.appendChild(sigImg);
        }

        inner.appendChild(front);
        inner.appendChild(back);
        container.appendChild(inner);

        // Evento de volteo (Flip) con doble click
        container.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            container.classList.toggle('card-flipped');
        });

        return container;
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('es-ES', options);
    }

    escapeCaption(text) {
        // Escape text to avoid being interpreted as formulas (e.g. +, =, @, etc.)
        return text
            .replace(/^[+=@-]/gm, '\\$&')
            .replace(/"/g, '"')
            .replace(/'/g, '&#39;')
            .replace(/</g, '<')
            .replace(/>/g, '>');
    }
}

/**
 * Movimiento, rotación y escala de la tarjeta en modo edición
 * Soporta locked, visible, zIndex
 */
export class PhotoCardTransformer {
    constructor(el, memory, savedState, onUpdate) {
        this.el = el;
        this.memory = memory;
        this.onUpdate = onUpdate;
        this.isDragging = false;
        this.isTransforming = false;
        
        this.state = {
            x: savedState ? parseFloat(savedState.x) || 0 : 0,
            y: savedState ? parseFloat(savedState.y) || 0 : 0,
            scale: savedState ? parseFloat(savedState.scale) || 1 : 1,
            rotation: savedState ? parseFloat(savedState.rotation) || 0 : 0,
            zIndex: savedState ? parseInt(savedState.zIndex) || 5 : 5,
            locked: savedState ? !!savedState.locked : false,
            visible: savedState ? savedState.visible !== false : true
        };
        
        if (savedState) this.applyTransform();
        
        // Only add pointer events if not locked
        if (!this.state.locked) {
            this.el.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        }
        
        // Add transform handles when in edit mode
        this.addTransformHandles();
    }

    applyTransform() {
        this.el.style.transform = `translate(${this.state.x}px, ${this.state.y}px) scale(${this.state.scale}) rotate(${this.state.rotation}deg)`;
        this.el.style.zIndex = this.state.zIndex;
        if (!this.state.visible) {
            this.el.style.display = 'none';
        }
    }

    addTransformHandles() {
        // Create resize handles at corners
        if (this.el.querySelector('.transform-handles')) return;
        
        const handlesContainer = document.createElement('div');
        handlesContainer.className = 'transform-handles';
        
        // Add 4 corner handles
        const positions = ['nw', 'ne', 'sw', 'se'];
        positions.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `transform-handle handle-${pos}`;
            handle.dataset.handlePos = pos;
            
            handle.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                this.startTransform(e, pos);
            });
            
            handlesContainer.appendChild(handle);
        });
        
        this.el.appendChild(handlesContainer);
    }

    onPointerDown(e) {
        if (!document.getElementById('app-container').classList.contains('admin-mode')) return;
        
        // Ignore if handle was clicked
        if (e.target.classList.contains('transform-handle')) return;
        
        e.preventDefault();
        e.stopPropagation();

        if (this.el.classList.contains('centered-card')) {
            this.el.classList.remove('centered-card');
            const rect = this.el.getBoundingClientRect();
            const parent = this.el.offsetParent.getBoundingClientRect();
            this.state.x = rect.left - parent.left;
            this.state.y = rect.top - parent.top;
        }

        this.isDragging = true;
        this.startX = e.clientX - this.state.x;
        this.startY = e.clientY - this.state.y;

        // Dispatch elementSelected for editor panel
        window.dispatchEvent(new CustomEvent('elementSelected', { detail: this }));

        const move = (ev) => {
            if (!this.isDragging) return;
            this.state.x = ev.clientX - this.startX;
            this.state.y = ev.clientY - this.startY;
            this.applyTransform();
        };
        const up = () => {
            this.isDragging = false;
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            this.syncData();
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    }

    startTransform(e, handlePos) {
        if (!document.getElementById('app-container').classList.contains('admin-mode')) return;
        
        e.preventDefault();
        e.stopPropagation();
        this.isTransforming = true;
        
        const startRect = this.el.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const startScale = this.state.scale;
        const startRotation = this.state.rotation;
        const startCenterX = startRect.left + startRect.width / 2;
        const startCenterY = startRect.top + startRect.height / 2;

        const transformMove = (ev) => {
            if (!this.isTransforming) return;
            
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            
            // Scale based on diagonal movement
            const scaleDelta = (dx + dy) / 200;
            this.state.scale = Math.max(0.3, Math.min(3, startScale + scaleDelta));
            
            // Rotation based on angle from center
            const currentAngle = Math.atan2(ev.clientY - startCenterY, ev.clientX - startCenterX);
            const startAngle = Math.atan2(startY - startCenterY, startX - startCenterX);
            const angleDiff = (currentAngle - startAngle) * (180 / Math.PI);
            this.state.rotation = startRotation + angleDiff;
            
            this.applyTransform();
        };

        const transformUp = () => {
            this.isTransforming = false;
            window.removeEventListener('pointermove', transformMove);
            window.removeEventListener('pointerup', transformUp);
            this.syncData();
        };

        window.addEventListener('pointermove', transformMove);
        window.addEventListener('pointerup', transformUp);
    }

    syncData() {
        if (this.onUpdate) {
            this.onUpdate({
                x: this.state.x,
                y: this.state.y,
                scale: this.state.scale,
                rotation: this.state.rotation,
                zIndex: this.state.zIndex,
                locked: this.state.locked,
                visible: this.state.visible
            });
        }
    }
}