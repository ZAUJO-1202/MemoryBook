import { API } from './api.js';
import { Album } from './album.js';
import { FontLoader } from './fonts.js';
import { PageElement } from './pageElement.js';
import { MemoryModal } from './memory.js';
import { AuthManager } from './auth.js';

/**
 * Controlador de la barra lateral de edición - Overlay style (Canva/Figma)
 * Soporta locked, visible para todos los elementos incluyendo photocards
 * IMPORTANTE: admin-mode permite interacción con elementos SIN sidebar visible
 * editing-mode solo controla la visibilidad de la sidebar
 */
class EditorSidebar {
    constructor() {
        this.sidebar = document.getElementById('editor-sidebar');
        this.currentSelectedElement = null;
        this.backdrop = null;
    }

    init() {
        // Create backdrop element
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'editor-backdrop';
        document.body.appendChild(this.backdrop);

        this.setupTabs();
        this.setupFields();
        this.setupGlobalConfig();
        this.loadStickers();

        window.addEventListener('elementSelected', (e) => this.bindElementProperties(e.detail));
        document.getElementById('btn-close-sidebar').addEventListener('click', () => {
            this.toggle(false);
            document.getElementById('btn-toggle-edit').classList.remove('active-mode');
        });
        MemoryModal.init();
    }

    toggle(forceState) {
        const shouldOpen = forceState !== undefined ? forceState : !this.sidebar.classList.contains('visible');
        
        if (shouldOpen) {
            this.sidebar.classList.remove('sidebar-hidden');
            this.sidebar.classList.add('visible');
            this.backdrop.classList.add('visible');
            this.populateConfigFields();
            // Prevent body scroll while sidebar is open (mobile)
            document.body.style.overflow = 'hidden';
        } else {
            this.sidebar.classList.remove('visible');
            this.sidebar.classList.add('sidebar-hidden');
            this.backdrop.classList.remove('visible');
            document.body.style.overflow = '';
        }
    }

    setupTabs() {
        document.querySelectorAll('.tab-link').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tab.dataset.tab).classList.add('active');
            });
        });
    }

    populateConfigFields() {
        const cfg = Album.getConfig();
        document.getElementById('cfg-title').value = cfg.title || '';
        document.getElementById('cfg-subtitle').value = cfg.subtitle || '';
        document.getElementById('cfg-cover-texture').value = cfg.coverTexture || 'leather';
        document.getElementById('cfg-cover-color').value = cfg.coverColor || '#2D1918';
        document.getElementById('cfg-accent-color').value = cfg.accentColor || '#D4AF37';
        document.getElementById('cfg-bg-color').value = cfg.backgroundColor || '#120B0B';
        document.getElementById('cfg-font-heading').value = cfg.fontHeading || 'Cormorant Garamond';
        document.getElementById('cfg-font-body').value = cfg.fontBody || 'Caveat';
        document.getElementById('cfg-page-width').value = cfg.pageWidth || 420;
        document.getElementById('cfg-page-height').value = cfg.pageHeight || 600;
        document.getElementById('cfg-page-texture').value = cfg.pageTexture || 'paper';
        document.getElementById('cfg-music-url').value = cfg.musicUrl || '';
        document.getElementById('cfg-music-autoplay').checked = !!cfg.musicAutoplay;
    }

    setupGlobalConfig() {
        // Populate google fonts datalist for config tab
        const cfgFontList = document.getElementById('google-fonts-list-cfg');
        if (cfgFontList) FontLoader.populateDataList(cfgFontList);
        
        document.getElementById('btn-save-global').addEventListener('click', async () => {
            const btn = document.getElementById('btn-save-global');
            const status = document.getElementById('sync-status');
            btn.disabled = true;
            status.textContent = 'Guardando...';
            status.className = 'syncing';

            const configData = {
                title: document.getElementById('cfg-title').value,
                subtitle: document.getElementById('cfg-subtitle').value,
                coverTexture: document.getElementById('cfg-cover-texture').value,
                coverColor: document.getElementById('cfg-cover-color').value,
                accentColor: document.getElementById('cfg-accent-color').value,
                backgroundColor: document.getElementById('cfg-bg-color').value || '#120B0B',
                fontHeading: document.getElementById('cfg-font-heading').value || 'Cormorant Garamond',
                fontBody: document.getElementById('cfg-font-body').value || 'Caveat',
                pageWidth: parseInt(document.getElementById('cfg-page-width').value) || 420,
                pageHeight: parseInt(document.getElementById('cfg-page-height').value) || 600,
                pageTexture: document.getElementById('cfg-page-texture').value || 'paper',
                musicUrl: document.getElementById('cfg-music-url').value,
                musicAutoplay: document.getElementById('cfg-music-autoplay').checked,
                photoStyle: Album.getConfig().photoStyle || 'polaroid',
                animationSpeed: Album.getConfig().animationSpeed || 700
            };

            const result = await API.saveConfig(configData);

            if (result.success) {
                // Update config and reload album
                Album.updateConfig(configData);
                
                // Close admin session, clear temporary layers
                AuthManager.clear();
                document.getElementById('app-container').classList.remove('admin-mode');
                
                // Close sidebar
                this.toggle(false);
                document.getElementById('btn-toggle-edit').classList.remove('active-mode');
                
                // Show success toast
                MemoryModal.showToast('Cambios guardados correctamente', 'success');
                
                // Reload page on cover after a brief delay
                setTimeout(() => {
                    window.location.hash = '#cover';
                    window.location.reload();
                }, 1200);
            } else {
                status.textContent = 'Error al guardar';
                status.className = 'error';
                MemoryModal.showToast('Error: ' + (result.error || 'No se pudo guardar'), 'error');
            }
            btn.disabled = false;
        });

        FontLoader.populateDataList(document.getElementById('google-fonts-list'));
    }

    async loadStickers() {
        const grid = document.getElementById('stickers-library');
        grid.innerHTML = '<p class="loading-text">Cargando stickers...</p>';

        const result = await API.getStickers();
        grid.innerHTML = '';

        if (!result.success || !result.stickers?.length) {
            grid.innerHTML = '<p class="empty-stickers">No hay stickers en la carpeta de Drive.</p>';
            return;
        }

        result.stickers.forEach(sticker => {
            const item = document.createElement('div');
            item.className = 'sticker-item';
            item.title = sticker.name;
            item.innerHTML = `<img src="${sticker.url}" alt="${sticker.name}" loading="lazy">`;
            item.addEventListener('click', () => this.addStickerToCurrentPage(sticker));
            grid.appendChild(item);
        });
    }

    addStickerToCurrentPage(sticker) {
        const currentPage = Album.pages[Album.currentPageIndex];
        if (!currentPage || currentPage.classList.contains('cover-page')) {
            MemoryModal.showToast('Navega a una página de recuerdo para añadir stickers', 'info');
            return;
        }

        const memoryId = currentPage.dataset.memoryId;
        const face = currentPage.querySelector('.page-face.front');
        if (!face) return;

        PageElement.createSticker(sticker, memoryId, face, (updated) => {
            Album.onElementUpdate(memoryId, updated);
        });
        MemoryModal.showToast('Sticker añadido', 'success');
    }

    setupFields() {
        const scaleSlider = document.getElementById('el-scale');
        const rotSlider = document.getElementById('el-rotation');

        scaleSlider.addEventListener('input', (e) => {
            if (!this.currentSelectedElement) return;
            this.currentSelectedElement.state.scale = parseFloat(e.target.value);
            this.currentSelectedElement.applyTransform();
        });

        rotSlider.addEventListener('input', (e) => {
            if (!this.currentSelectedElement) return;
            this.currentSelectedElement.state.rotation = parseInt(e.target.value);
            this.currentSelectedElement.applyTransform();
        });

        document.getElementById('el-text-content').addEventListener('input', (e) => {
            if (!this.currentSelectedElement) return;
            this.currentSelectedElement.updateFromPanel({ content: e.target.value });
        });

        document.getElementById('el-color').addEventListener('input', (e) => {
            if (!this.currentSelectedElement) return;
            this.currentSelectedElement.updateFromPanel({ color: e.target.value });
        });

        document.getElementById('el-font-family').addEventListener('change', (e) => {
            if (!this.currentSelectedElement) return;
            FontLoader.load(e.target.value);
            this.currentSelectedElement.updateFromPanel({ font: e.target.value });
        });

        document.getElementById('el-zindex').addEventListener('change', (e) => {
            if (!this.currentSelectedElement) return;
            this.currentSelectedElement.data.zIndex = parseInt(e.target.value);
            this.currentSelectedElement.el.style.zIndex = e.target.value;
            this.currentSelectedElement.syncData();
        });

        // Locked checkbox
        document.getElementById('el-locked').addEventListener('change', (e) => {
            if (!this.currentSelectedElement) return;
            this.currentSelectedElement.data.locked = e.target.checked;
            if (e.target.checked) {
                this.currentSelectedElement.el.style.cursor = 'default';
                this.currentSelectedElement.el.style.pointerEvents = 'none';
            } else {
                this.currentSelectedElement.el.style.cursor = 'grab';
                this.currentSelectedElement.el.style.pointerEvents = 'auto';
            }
            this.currentSelectedElement.syncData();
        });

        // Visible checkbox
        document.getElementById('el-visible').addEventListener('change', (e) => {
            if (!this.currentSelectedElement) return;
            this.currentSelectedElement.data.visible = e.target.checked;
            this.currentSelectedElement.el.style.display = e.target.checked ? '' : 'none';
            this.currentSelectedElement.syncData();
        });

        document.getElementById('btn-el-delete').addEventListener('click', () => {
            if (!this.currentSelectedElement?.el) return;
            this.currentSelectedElement.el.remove();
            const memoryId = this.currentSelectedElement.data.memoryId;
            const elements = Album.pageElementsMap.get(memoryId) || [];
            Album.pageElementsMap.set(memoryId, elements.filter(el => el.id !== this.currentSelectedElement.data.id));
            Album.debouncedSaveElements(memoryId);
            this.clearElementSelection();
        });

        scaleSlider.addEventListener('change', () => this.currentSelectedElement?.syncData());
        rotSlider.addEventListener('change', () => this.currentSelectedElement?.syncData());
    }

    bindElementProperties(elementInstance) {
        this.currentSelectedElement = elementInstance;

        document.getElementById('no-element-selected').classList.add('hidden');
        document.getElementById('element-controls').classList.remove('hidden');

        const isText = elementInstance.data.type === 'text';
        document.querySelectorAll('.text-only-control').forEach(el => {
            el.classList.toggle('hidden', !isText);
        });

        // Populate fields
        document.getElementById('el-scale').value = elementInstance.state.scale;
        document.getElementById('el-rotation').value = elementInstance.state.rotation;
        document.getElementById('el-zindex').value = elementInstance.data.zIndex || 10;
        if (elementInstance.data.color) {
            document.getElementById('el-color').value = elementInstance.data.color;
        }
        document.getElementById('el-text-content').value = elementInstance.data.content || '';
        document.getElementById('el-font-family').value = elementInstance.data.font || '';

        // Locked and visible checkboxes
        document.getElementById('el-locked').checked = !!elementInstance.data.locked;
        document.getElementById('el-visible').checked = elementInstance.data.visible !== false;

        // Switch to element tab
        document.querySelector('[data-tab="tab-element"]').click();
    }

    clearElementSelection() {
        this.currentSelectedElement = null;
        document.getElementById('no-element-selected').classList.remove('hidden');
        document.getElementById('element-controls').classList.add('hidden');
    }
}

export const Sidebar = new EditorSidebar();