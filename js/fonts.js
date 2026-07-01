/**
 * Inyector Dinámico de Tipografías mediante Google Fonts API
 */
export const FontLoader = {
    loadedFonts: new Set(),

    load(fontName) {
        if (!fontName || this.loadedFonts.has(fontName)) return;

        const formattedFont = fontName.replace(/\s+/g, '+');
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${formattedFont}:wght@400;700&display=swap`;
        
        document.head.appendChild(link);
        this.loadedFonts.add(fontName);
    },

    populateDataList(datalistElement, commonFonts = ['Cormorant Garamond', 'Caveat', 'Playfair Display', 'Inter', 'Montserrat', 'Dancing Script', 'Pacifico']) {
        datalistElement.innerHTML = '';
        commonFonts.forEach(font => {
            const option = document.createElement('option');
            option.value = font;
            datalistElement.appendChild(option);
        });
    }
};