/**
 * Utilidades compartidas del ecosistema MemoryBook
 */

// Optimiza los enlaces de Google Drive para evitar fallos de renderizado
export function optimizeDriveUrl(url) {
    if (!url) return '';
    const regExp = /(?:id=|\/d\/|folders\/)([a-zA-Z0-9-_]+)/;
    const match = url.match(regExp);
    if (match && match[1]) {
        // Retorna la pasarela directa de contenido estático optimizado de Google
        return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
    return url;
}

// Genera un ID incremental único basado en entropía temporal
export function generateUUID() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Función Anti-rebote para optimizar el autoguardado sincrónico
export function debounce(func, delay = 1000) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Lazy loader inteligente para recursos gráficos
export function preloadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = optimizeDriveUrl(src);
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
    });
}