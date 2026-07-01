import { API } from './api.js';
import { debounce } from './utils.js';

/**
 * Motor de Transformación Mecánica (Drag, Scale, Rotate) sin librerías externas
 */
export class MoveableElement {
    constructor(domElement, data, onUpdate) {
        this.el = domElement;
        this.data = data;
        this.onUpdate = onUpdate;
        this.isDragging = false;
        this.isTransforming = false;
        
        this.state = {
            x: parseFloat(data.x) || 100,
            y: parseFloat(data.y) || 100,
            scale: parseFloat(data.scale) || 1,
            rotation: parseFloat(data.rotation) || 0
        };

        this.initInteractions();
    }

    initInteractions() {
        // Envolver el elemento en un contenedor de transformación interactivo si está en modo edición
        this.el.style.transform = `translate(${this.state.x}px, ${this.state.y}px) scale(${this.state.scale}) rotate(${this.state.rotation}deg)`;
        
        this.el.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
    }

    handlePointerDown(e) {
        if (!document.getElementById('app-container').classList.contains('editing-mode')) return;
        if (e.target.classList.contains('control-handle')) {
            this.isTransforming = true;
            this.setupTransform(e);
            return;
        }

        this.isDragging = true;
        this.startX = e.clientX - this.state.x;
        this.startY = e.clientY - this.state.y;
        
        const moveHandler = (ev) => this.handlePointerMove(ev);
        const upHandler = () => {
            this.isDragging = false;
            window.removeEventListener('pointermove', moveHandler);
            window.removeEventListener('pointerup', upHandler);
            this.syncData();
        };

        window.addEventListener('pointermove', moveHandler);
        window.addEventListener('pointerup', upHandler);
        
        // Disparar evento de selección para actualizar el panel estilo Figma
        window.dispatchEvent(new CustomEvent('elementSelected', { detail: this }));
    }

    handlePointerMove(e) {
        if (this.isDragging) {
            this.state.x = e.clientX - this.startX;
            this.state.y = e.clientY - this.startY;
            this.updateDOMTransform();
        }
    }

    setupTransform(e) {
        // Lógica básica para escalado y rotación interactiva mediante handles de esquina
        e.preventDefault();
        const startScale = this.state.scale;
        const startPointerX = e.clientX;

        const transformMove = (ev) => {
            const deltaX = ev.clientX - startPointerX;
            this.state.scale = Math.max(0.5, startScale + deltaX * 0.01);
            this.updateDOMTransform();
        };

        const transformUp = () => {
            window.removeEventListener('pointermove', transformMove);
            window.removeEventListener('pointerup', transformUp);
            this.syncData();
        };

        window.addEventListener('pointermove', transformMove);
        window.addEventListener('pointerup', transformUp);
    }

    updateDOMTransform() {
        this.el.style.transform = `translate(${this.state.x}px, ${this.state.y}px) scale(${this.state.scale}) rotate(${this.state.rotation}deg)`;
        this.el.style.zIndex = this.data.zIndex || 10;
    }

    syncData() {
        this.data.x = this.state.x;
        this.data.y = this.state.y;
        this.data.scale = this.state.scale;
        this.data.rotation = this.state.rotation;
        if (this.onUpdate) this.onUpdate(this.data);
    }
}