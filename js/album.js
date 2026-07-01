import { PhotoCard, PhotoCardTransformer } from './photocard.js';
import { PageElement } from './pageElement.js';
import { API } from './api.js';
import { FontLoader } from './fonts.js';

/**
 * Gestor del ciclo de vida del álbum de páginas
 */
class AlbumBook {
    constructor() {
        this.pages = [];
        this.currentPageIndex = 0;
        this.config = {};
        this.memories = [];
        this.container = document.getElementById('book-container');
        this.pageElementsMap = new Map();
    }

    async build(data) {
        this.config = data.config || {};
        this.memories = data.memories || [];
        this.currentPageIndex = 0;
        this.pageElementsMap.clear();
        this.container.innerHTML = '';

        this.applyGlobalStyles();
        this.createCoverPage(this.config);

        for (let i = 0; i < this.memories.length; i++) {
            await this.createMemoryPage(this.memories[i], i);
        }

        this.resetPageStates();
        this.updateNavigationUI();
        this.scaleBookToViewport();
    }

    async reload() {
        const data = await API.getAlbumData();
        if (data.success !== false) {
            await this.build(data);
        }
    }

    createCoverPage(config) {
        const pageNode = document.createElement('div');
        pageNode.className = 'book-page cover-page';
        pageNode.style.zIndex = this.memories.length + 2;

        const texture = config.coverTexture || 'leather';
        const frontFace = document.createElement('div');
        frontFace.className = `page-face front texture-${texture}`;
        frontFace.style.backgroundColor = config.coverColor || '#2D1918';

        const headingFont = config.fontHeading || 'Cormorant Garamond';
        FontLoader.load(headingFont);

        frontFace.innerHTML = `
            <div class="cover-content" style="color: ${config.accentColor || '#D4AF37'}">
                <div class="cover-ornament">✦</div>
                <h1 style="font-family: '${headingFont}', serif">${config.title || 'Nuestro Álbum'}</h1>
                <div class="cover-divider"></div>
                <p class="cover-subtitle">${config.subtitle || ''}</p>
                <span class="cover-hint">Toca «Siguiente» para abrir</span>
            </div>
        `;

        pageNode.appendChild(frontFace);
        this.container.appendChild(pageNode);
        this.pages.push(pageNode);
    }

    async createMemoryPage(memory, index) {
        const pageNode = document.createElement('div');
        pageNode.className = 'book-page memory-page';
        pageNode.dataset.memoryId = memory.id;
        pageNode.style.zIndex = this.memories.length - index + 1;

        const texture = this.config.pageTexture || 'paper';
        const frontFace = document.createElement('div');
        frontFace.className = `page-face front texture-${texture}`;
        frontFace.dataset.memoryId = memory.id;

        // Apply fontBody to page content if configured
        if (this.config.fontBody) {
            FontLoader.load(this.config.fontBody);
            frontFace.style.fontFamily = `'${this.config.fontBody}', cursive`;
        }

        const cardComponent = new PhotoCard(memory);
        const cardDOM = cardComponent.render();
        frontFace.appendChild(cardDOM);

        const elementsResult = await API.getPageElements(memory.id);
        const elements = elementsResult.success ? (elementsResult.elements || []) : [];
        this.pageElementsMap.set(memory.id, elements);

        const cardElement = elements.find(el => el.type === 'photocard');
        if (cardElement) {
            cardDOM.style.transform = `translate(${cardElement.x}px, ${cardElement.y}px) scale(${cardElement.scale || 1}) rotate(${cardElement.rotation || 0}deg)`;
            cardDOM.style.zIndex = cardElement.zIndex || 5;
            // Apply locked/visible from saved data
            if (cardElement.locked) {
                cardDOM.style.pointerEvents = 'none';
                cardDOM.style.cursor = 'default';
            }
            if (cardElement.visible === false) {
                cardDOM.style.display = 'none';
            }
        } else {
            cardDOM.classList.add('centered-card');
        }

        elements.filter(el => el.type !== 'photocard' && el.visible !== false).forEach(el => {
            const pe = new PageElement(el, frontFace, (updated) => this.onElementUpdate(memory.id, updated));
            pe.render();
        });

        pageNode.appendChild(frontFace);
        this.container.appendChild(pageNode);
        this.pages.push(pageNode);

        // Use PhotoCardTransformer with rotation, scale, zIndex, locked, visible support
        new PhotoCardTransformer(cardDOM, memory, cardElement, (data) => {
            this.savePhotocardPosition(memory.id, data);
        });
    }

    onElementUpdate(memoryId, updatedElement) {
        const elements = this.pageElementsMap.get(memoryId) || [];
        const idx = elements.findIndex(el => el.id === updatedElement.id);
        if (idx >= 0) elements[idx] = updatedElement;
        else elements.push(updatedElement);
        this.pageElementsMap.set(memoryId, elements);
        this.debouncedSaveElements(memoryId);
    }

    debouncedSaveElements(memoryId) {
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(async () => {
            const elements = this.pageElementsMap.get(memoryId) || [];
            const status = document.getElementById('sync-status');
            status.textContent = 'Guardando...';
            status.className = 'syncing';
            const result = await API.savePageElements(memoryId, elements);
            status.textContent = result.success ? 'Sincronizado' : 'Error al guardar';
            status.className = result.success ? 'synced' : 'error';
        }, 800);
    }

    savePhotocardPosition(memoryId, transformData) {
        const elements = this.pageElementsMap.get(memoryId) || [];
        let cardEl = elements.find(el => el.type === 'photocard');
        if (!cardEl) {
            cardEl = {
                id: 'pc_' + memoryId,
                memoryId,
                type: 'photocard',
                content: '',
                x: transformData.x,
                y: transformData.y,
                scale: transformData.scale,
                rotation: transformData.rotation,
                zIndex: transformData.zIndex || 5,
                locked: transformData.locked || false,
                visible: transformData.visible !== false
            };
            elements.push(cardEl);
        } else {
            Object.assign(cardEl, transformData);
        }
        this.pageElementsMap.set(memoryId, elements);
        this.debouncedSaveElements(memoryId);
    }

    applyGlobalStyles() {
        const ws = document.getElementById('workspace');
        if (this.config.backgroundColor) ws.style.backgroundColor = this.config.backgroundColor;

        if (this.config.fontBody) FontLoader.load(this.config.fontBody);

        const music = document.getElementById('bg-music');
        if (this.config.musicUrl) {
            music.src = this.config.musicUrl;
            if (this.config.musicAutoplay) {
                music.play().catch(() => {});
            }
        }
    }

    resetPageStates() {
        this.pages.forEach(p => p.classList.remove('flipped'));
        this.currentPageIndex = 0;
    }

    next() {
        if (this.currentPageIndex < this.pages.length - 1) {
            this.pages[this.currentPageIndex].classList.add('flipped');
            this.currentPageIndex++;
            this.updateNavigationUI();
        }
    }

    prev() {
        if (this.currentPageIndex > 0) {
            this.currentPageIndex--;
            this.pages[this.currentPageIndex].classList.remove('flipped');
            this.updateNavigationUI();
        }
    }

    goToLastPage() {
        while (this.currentPageIndex < this.pages.length - 1) {
            this.next();
        }
    }

    updateNavigationUI() {
        document.getElementById('btn-prev').disabled = this.currentPageIndex === 0;
        document.getElementById('btn-next').disabled = this.currentPageIndex >= this.pages.length - 1;

        const indicator = document.getElementById('page-indicator');
        if (this.currentPageIndex === 0) {
            indicator.textContent = 'Portada';
        } else {
            indicator.textContent = `Recuerdo ${this.currentPageIndex} de ${this.pages.length - 1}`;
        }
    }

    scaleBookToViewport() {
        const viewport = document.getElementById('album-viewport');
        const book = this.container;
        const baseW = parseInt(this.config.pageWidth || 420) * 2;
        const baseH = parseInt(this.config.pageHeight || 600);

        book.style.width = baseW + 'px';
        book.style.height = baseH + 'px';

        const doScale = () => {
            const pad = window.innerWidth < 768 ? 6 : 20;
            const vw = viewport.clientWidth - pad * 2;
            const vh = viewport.clientHeight - pad * 2;
            const scale = Math.min(vw / baseW, vh / baseH, 1.2);
            book.style.transform = `scale(${scale})`;
            book.style.transformOrigin = 'center center';
        };

        doScale();
        if (!this._resizeBound) {
            this._resizeBound = true;
            window.addEventListener('resize', doScale);
            window.addEventListener('orientationchange', () => setTimeout(doScale, 300));
        }
    }

    getConfig() {
        return { ...this.config };
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
}

export const Album = new AlbumBook();