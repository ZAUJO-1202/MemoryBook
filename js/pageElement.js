import { generateUUID } from './utils.js';
import { optimizeDriveUrl } from './utils.js';

/**
 * Elemento decorativo sobre una página (texto, sticker)
 */
export class PageElement {
    constructor(data, parentFace, onUpdate) {
        this.data = data;
        this.parent = parentFace;
        this.onUpdate = onUpdate;
        this.el = null;
        this.state = {
            x: parseFloat(data.x) || 50,
            y: parseFloat(data.y) || 50,
            scale: parseFloat(data.scale) || 1,
            rotation: parseFloat(data.rotation) || 0
        };
    }

    render() {
        this.el = document.createElement('div');
        this.el.className = `page-element page-element-${this.data.type}`;
        this.el.dataset.id = this.data.id;
        this.el.style.zIndex = this.data.zIndex || 10;

        if (this.data.type === 'text') {
            this.el.textContent = this.data.content || '';
            this.el.style.color = this.data.color || '#1c1b18';
            if (this.data.font) this.el.style.fontFamily = `'${this.data.font}', cursive`;
        } else if (this.data.type === 'sticker') {
            const img = document.createElement('img');
            img.src = optimizeDriveUrl(this.data.content);
            img.alt = 'Sticker';
            img.draggable = false;
            this.el.appendChild(img);
        }

        this.applyTransform();
        this.parent.appendChild(this.el);

        if (!this.data.locked) {
            this.el.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        }

        return this.el;
    }

    applyTransform() {
        this.el.style.transform = `translate(${this.state.x}px, ${this.state.y}px) scale(${this.state.scale}) rotate(${this.state.rotation}deg)`;
    }

    onPointerDown(e) {
        if (!document.getElementById('app-container').classList.contains('editing-mode')) return;
        e.stopPropagation();
        e.preventDefault();

        this.isDragging = true;
        this.startX = e.clientX - this.state.x;
        this.startY = e.clientY - this.state.y;

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

    syncData() {
        this.data.x = this.state.x;
        this.data.y = this.state.y;
        this.data.scale = this.state.scale;
        this.data.rotation = this.state.rotation;
        if (this.onUpdate) this.onUpdate(this.data);
    }

    updateFromPanel(props) {
        Object.assign(this.data, props);
        Object.assign(this.state, {
            scale: parseFloat(props.scale) || this.state.scale,
            rotation: parseFloat(props.rotation) || this.state.rotation
        });
        if (props.color !== undefined) this.el.style.color = props.color;
        if (props.content !== undefined && this.data.type === 'text') this.el.textContent = props.content;
        if (props.font !== undefined) this.el.style.fontFamily = `'${props.font}', cursive`;
        this.applyTransform();
        this.syncData();
    }

    static createSticker(sticker, memoryId, parentFace, onUpdate) {
        const data = {
            id: generateUUID(),
            memoryId,
            type: 'sticker',
            content: sticker.url,
            x: 120,
            y: 120,
            scale: 1,
            rotation: 0,
            color: '',
            zIndex: 15,
            font: '',
            locked: false,
            visible: true
        };
        const pe = new PageElement(data, parentFace, onUpdate);
        pe.render();
        return pe;
    }
}
