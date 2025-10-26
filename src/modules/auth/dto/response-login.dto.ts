import { ApiProperty } from '@nestjs/swagger';

export class LoginDataDto {
    @ApiProperty({ example: 1 })
    id_usuario: number;

    @ApiProperty({ example: 'sysadmin@ixc.com' })
    usuario: string;

    @ApiProperty({
        example: '$2b$10$mTJqT9h3k3MJthiLlkW9OO80InH8SgVyWIpRdvAcrj7iE3QgAWrOa',
        description: 'Hash de contraseña',
    })
    password: string;

    @ApiProperty({ example: 'Usuario' })
    nombres: string;

    @ApiProperty({ example: 'Demo' })
    apellidos: string;

    @ApiProperty({ example: 1 })
    id_sucursal: number;

    @ApiProperty({ example: '1234567890', nullable: true })
    dui: string | null;

    @ApiProperty({ example: null, nullable: true })
    foto: string | null;

    @ApiProperty({ example: 'ACTIVO' })
    estado: string;

    @ApiProperty({ example: '2025-10-24T19:00:17.781Z' })
    fecha_creacion: string;

    @ApiProperty({ example: 1 })
    id_rol: number;

    @ApiProperty({ example: null, nullable: true })
    id_tipo_documento: number | null;

    @ApiProperty({
        example:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZF91c3VhcmlvIjoxLCJpZF9zdWN1cnNhbCI6MSwiaWF0IjoxNzYxMzMyODU0LCJleHAiOjE3NjEzNjE2NTR9.Bp_pgCo0ubOUmat8WZvj-PWrgVNw4AIGr7LIitYtkDY',
    })
    token: string;

    @ApiProperty({ example: 0 })
    id_general: number;

    @ApiProperty({ example: 'Sistema Administrativo' })
    nombre_sistema: string;

    @ApiProperty({ example: 'San Salvador' })
    direccion: string;

    @ApiProperty({ example: 'Razon' })
    razon: string;

    @ApiProperty({ example: '123456789' })
    nit: string;

    @ApiProperty({ example: '1234' })
    nrc: string;

    @ApiProperty({ example: null, nullable: true })
    cod_actividad: string | null;

    @ApiProperty({ example: null, nullable: true })
    desc_actividad: string | null;

    @ApiProperty({ example: null, nullable: true })
    nombre_comercial: string | null;

    @ApiProperty({ example: '234567890' })
    contactos: string;

    @ApiProperty({ example: null, nullable: true })
    correo: string | null;

    @ApiProperty({ example: null, nullable: true })
    cod_estable_MH: string | null;

    @ApiProperty({ example: null, nullable: true })
    cod_estable: string | null;

    @ApiProperty({ example: null, nullable: true })
    cod_punto_venta_MH: string | null;

    @ApiProperty({ example: null, nullable: true })
    cod_punto_venta: string | null;

    @ApiProperty({ example: 0.13 })
    impuesto: number;

    @ApiProperty({ example: '' })
    icono_sistema: string;

    @ApiProperty({ example: '' })
    icono_factura: string;
}

export class LoginEnvelopeDto {
    @ApiProperty({ type: LoginDataDto })
    data: LoginDataDto;

    @ApiProperty({ example: true })
    status: boolean;

    @ApiProperty({ example: 'Success' })
    msg: string;
}

// Ejemplo reutilizable
export const LOGIN_SUCCESS_EXAMPLE = {
    data: {
        id_usuario: 1,
        usuario: 'sysadmin@ixc.com',
        password: '$2b$10$mTJqT9h3k3MJthiLlkW9OO80InH8SgVyWIpRdvAcrj7iE3QgAWrOa',
        nombres: 'Usuario',
        apellidos: 'Demo',
        id_sucursal: 1,
        dui: '1234567890',
        foto: null,
        estado: 'ACTIVO',
        fecha_creacion: '2025-10-24T19:00:17.781Z',
        id_rol: 1,
        id_tipo_documento: null,
        token:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZF91c3VhcmlvIjoxLCJpZF9zdWN1cnNhbCI6MSwiaWF0IjoxNzYxMzMyODU0LCJleHAiOjE3NjEzNjE2NTR9.Bp_pgCo0ubOUmat8WZvj-PWrgVNw4AIGr7LIitYtkDY',
        id_general: 0,
        nombre_sistema: 'Sistema Administrativo',
        direccion: 'San Salvador',
        razon: 'Razon',
        nit: '123456789',
        nrc: '1234',
        cod_actividad: null,
        desc_actividad: null,
        nombre_comercial: null,
        contactos: '234567890',
        correo: null,
        cod_estable_MH: null,
        cod_estable: null,
        cod_punto_venta_MH: null,
        cod_punto_venta: null,
        impuesto: 0.13,
        icono_sistema: '',
        icono_factura: '',
    },
    status: true,
    msg: 'Success',
};