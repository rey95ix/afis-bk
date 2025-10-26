
export const formatNumber = (value: any, digits = 2): string => {
    value = parseFloat("" + value);
    if (value == undefined || value == null || isNaN(value)) {
        return '0.00';
    }
    return value.toFixed(digits);
};
export const formatNumberDecimal = (value: number, digits = 5): number => {
    if (value == undefined || value == null || isNaN(value)) return +('0.' + '0'.repeat(digits));

    // Formateamos el número con los dígitos especificados
    const formattedValue = +value.toFixed(digits);

    // Verificamos si el valor decimal es menor a 0.01
    const decimalPart = Math.abs(formattedValue % 1);
    if (decimalPart < 0.01) {
        // Retornamos el número truncado pero manteniendo los decimales configurados
        return +(Math.trunc(formattedValue).toFixed(digits));
    }

    return formattedValue;
};

export const formatNumberDecimalSinValidacion = (value: number, digits = 5): number => {
    if (value == undefined || value == null || isNaN(value)) return +('0.' + '0'.repeat(digits));

    // Formateamos el número con los dígitos especificados
    const formattedValue = +value.toFixed(digits);

    return formattedValue;
};