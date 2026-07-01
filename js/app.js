import { API } from './api.js';
import { Album } from './album.js';
import { Sidebar } from './editor.js';
import { AuthManager } from './auth.js';
import { MemoryModal } from './memory.js';

/**
 * Orquestador central de la aplicación
 */
class AppEngine {
    async start() {
        const loader = document.getElementById('app-loader');
        try {
            await API.init();
            Sidebar.init();

            const albumData = await API.getAlbumData();
            if (albumData.success === false) {
                throw new Error(albumData.error || 'Error al cargar el álbum');
            }

            await Album.build(albumData);
            this.bindGlobalEvents();
            this.evaluateInitialAuth();

        } catch (error) {
            console.error('Error al iniciar MemoryBook:', error);
            this.showBootError(error.message);
        } finally {
            if (loader) loader.classList.add('hidden');
        }
    }

    showBootError(msg) {
        const viewport = document.getElementById('album-viewport');
        viewport.innerHTML = `
            <div class="boot-error">
                <h2>No se pudo cargar el álbum</h2>
                <p>${msg}</p>
                <button onclick="location.reload()" class="primary-btn">Reintentar</button>
            </div>
        `;
    }

    bindGlobalEvents() {
        document.getElementById('btn-next').addEventListener('click', () => Album.next());
        document.getElementById('btn-prev').addEventListener('click', () => Album.prev());

        // Edit button flow: click → auth if not logged in → toggle sidebar overlay
        document.getElementById('btn-toggle-edit').addEventListener('click', () => {
            if (AuthManager.isEditable) {
                // Toggle sidebar overlay
                Sidebar.toggle();
                // Update button visual state
                document.getElementById('btn-toggle-edit').classList.toggle('active-mode');
            } else {
                // Show auth modal
                document.getElementById('auth-modal').classList.remove('hidden');
                document.getElementById('auth-password').focus();
            }
        });

        document.getElementById('btn-auth-confirm').addEventListener('click', () => {
            const pass = document.getElementById('auth-password').value;
            if (AuthManager.validate(pass)) {
                document.getElementById('auth-modal').classList.add('hidden');
                document.getElementById('auth-password').value = '';
                document.getElementById('btn-toggle-edit').classList.add('active-mode');
                Sidebar.toggle(true);
            } else {
                MemoryModal.showToast('Clave de administrador incorrecta', 'error');
            }
        });

        document.getElementById('btn-auth-cancel').addEventListener('click', () => {
            document.getElementById('auth-modal').classList.add('hidden');
            document.getElementById('auth-password').value = '';
        });

        document.getElementById('auth-password').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('btn-auth-confirm').click();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') Album.next();
            if (e.key === 'ArrowLeft') Album.prev();
        });

        // Close sidebar with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && Sidebar.sidebar.classList.contains('visible')) {
                Sidebar.toggle(false);
                document.getElementById('btn-toggle-edit').classList.remove('active-mode');
            }
        });

        // Close sidebar when clicking backdrop
        document.addEventListener('click', (e) => {
            const backdrop = document.querySelector('.editor-backdrop');
            if (backdrop && backdrop.classList.contains('visible') && e.target === backdrop) {
                Sidebar.toggle(false);
                document.getElementById('btn-toggle-edit').classList.remove('active-mode');
            }
        });
    }

    evaluateInitialAuth() {
        if (AuthManager.checkSession()) {
            document.getElementById('btn-toggle-edit').classList.add('active-mode');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AppEngine().start();
});