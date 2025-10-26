
export const convert = (str: string) => {
    var date = new Date(str),
        mnth = ("0" + (date.getMonth() + 1)).slice(-2),
        day = ("0" + date.getDate()).slice(-2);
    return [date.getFullYear(), mnth, day].join("-");
};
export const convertWithTime = (str: string) => {
    // Crear fecha UTC
    const utcDate = new Date(str);

    // Convertir a tiempo de El Salvador (UTC-6)
    const svOptions: any = {
        timeZone: 'America/El_Salvador',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };

    // Formatear la fecha según la zona horaria de El Salvador
    const svDateTime = utcDate.toLocaleString('es-SV', svOptions);

    // Reformatear al formato deseado YYYY-MM-DD HH:mm:ss
    const [date, time] = svDateTime.split(', ');
    const [day, month, year] = date.split('/');

    return `${year}-${month}-${day} ${time}`;
};

export const convertToUTC = (fecha: string, hora: string = "inicio"): Date => {
    const fechaParts: string[] = fecha.toString().split('-');
    const year: number = parseInt(fechaParts[0]);
    const month: number = parseInt(fechaParts[1]) - 1; // Los meses en JS son 0-11
    const day: number = parseInt(fechaParts[2]);

    if (hora === "inicio") {
        // Crear fecha UTC para inicio del día (00:00:00)
        const date = new Date(Date.UTC(year, month, day, 0, 0, 0));
        //agregar 6 horas
        date.setHours(date.getHours() + 6);
        return date;
    } else {
        // Crear fecha UTC para fin del día (23:59:59)
        const date = new Date(Date.UTC(year, month, day, 23, 59, 59));
        //agregar 6 horas
        date.setHours(date.getHours() + 6);
        return date;
    }
};