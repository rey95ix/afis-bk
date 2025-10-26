
export const eliminarGuionesYEspacios = (texto: string): string => {
    return texto.replace(/[-\s]/g, '');
};