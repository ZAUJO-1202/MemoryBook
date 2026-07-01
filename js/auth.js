/**
 * Control de Accesos y Permisos de Escritura
 */
export const AuthManager = {
    isEditable: false,
    _tokenKey: 'mb_admin_token',
    // Firma criptográfica o texto plano definido en los parámetros del usuario
    superPassword: 'DoceMeses04072026', 

    checkSession() {
        const token = localStorage.getItem(this._tokenKey);
        if (token === btoa(this.superPassword)) {
            this.isEditable = true;
        }
        return this.isEditable;
    },

    validate(password) {
        if (password === this.superPassword) {
            this.isEditable = true;
            localStorage.setItem(this._tokenKey, btoa(password));
            return true;
        }
        return false;
    },

    clear() {
        this.isEditable = false;
        localStorage.removeItem(this._tokenKey);
    }
};