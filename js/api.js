/**
 * Cliente de conectividad con Google Apps Script
 */
class ApiService {
    constructor() {
        this.endpoint = '';
    }

    async init() {
        const res = await fetch('config/config.json');
        const config = await res.json();
        this.endpoint = config.appsScriptUrl;
    }

    async getAlbumData() {
        const response = await fetch(`${this.endpoint}?action=getFullAlbum`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    }

    async getStickers() {
        const response = await fetch(`${this.endpoint}?action=getStickers`);
        return response.json();
    }

    async getPageElements(memoryId) {
        const response = await fetch(`${this.endpoint}?action=getPageElements&memoryId=${encodeURIComponent(memoryId)}`);
        return response.json();
    }

    async saveConfig(configData) {
        return this._post({ action: 'saveConfig', config: configData });
    }

    async saveMemory(memoryData) {
        return this._post({ action: 'saveMemory', ...memoryData });
    }

    async savePageElements(memoryId, elements) {
        return this._post({ action: 'savePageElements', memoryId, elements });
    }

    async _post(payload) {
        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                redirect: 'follow',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch {
                return { success: false, error: text || 'Respuesta inválida del servidor' };
            }
        } catch (error) {
            console.error(`Error en acción [${payload.action}]:`, error);
            return { success: false, error: error.message };
        }
    }
}

export const API = new ApiService();
