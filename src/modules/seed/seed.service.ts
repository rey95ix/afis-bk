import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

//TODO: ELIMINAR AL FINALIZAR MIGRACIONES 
import { formatNumberDecimal } from 'src/common/helpers';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SeedService {
  private readonly logger = new Logger('UsersService');

  constructor(private readonly prisma: PrismaService) { }


  async executeSeed() {
    try { 


      //SUCURSAL DEMO
      await this.prisma.sucursales.createMany({
        data: [
          { 
            nombre: 'Casa Matriz',
            correo: 'demo@demo.com',
            telefono: '60457278',
            complemento: 'San salvador',
            id_municipio: 1,
            id_tipo_establecimiento: 2,
          }, 
        ],
      });
      //ROLS DEMO
      await this.prisma.roles.createMany({
        data: [{ nombre: 'Admin' }, { nombre: 'Facturacion' }],
      });

      //USUARIO DEMO
      const salt = bcrypt.genSaltSync();
      let password = bcrypt.hashSync('***123$$$', salt);

      await this.prisma.usuarios.create({
        data: {
          nombres: 'Usuario',
          apellidos: 'Demo',
          usuario: 'sysadmin@ixc.com',
          dui: '1234567890',
          password: password,
          id_rol: 1,
          id_sucursal: 1,
        },
      });

      await this.prisma.facturasTipos.createMany({
        data: [
          { id_tipo_factura: 1, version: 1, nombre: 'Factura', codigo: '01' },
          {
            id_tipo_factura: 2,
            version: 3,
            nombre: 'Comprobante de crédito fiscal',
            codigo: '03',
          },
          {
            id_tipo_factura: 3,
            version: 3,
            nombre: 'Nota de remisión',
            codigo: '04',
            activo: 'INACTIVO',
          },
          {
            id_tipo_factura: 4,
            version: 3,
            nombre: 'Nota de crédito',
            codigo: '05',
            activo: 'INACTIVO',
          },
          {
            id_tipo_factura: 5,
            version: 3,
            nombre: 'Nota de debito',
            codigo: '06',
            activo: 'INACTIVO',
          },
          {
            id_tipo_factura: 6,
            version: 1,
            nombre: 'Comprobante de retención',
            codigo: '07',
            activo: 'INACTIVO',
          },
          {
            id_tipo_factura: 7,
            version: 1,
            nombre: 'Comprobante de liquidación',
            codigo: '08',
            activo: 'INACTIVO',
          },
          {
            id_tipo_factura: 8,
            version: 1,
            nombre: 'Documento contable de liquidación',
            codigo: '09',
            activo: 'INACTIVO',
          },
          {
            id_tipo_factura: 9,
            version: 1,
            nombre: 'Facturas de exportación',
            codigo: '11',
          },
          {
            id_tipo_factura: 10,
            version: 1,
            nombre: 'Factura de sujeto excluido',
            codigo: '14',
          },
          {
            id_tipo_factura: 11,
            version: 1,
            nombre: 'Comprobante de donación ',
            codigo: '15',
            activo: 'INACTIVO',
          },
        ],
      });
      await this.prisma.generalData.create({
        data: {
          nombre_sistema: 'Sistema Administrativo',
          impuesto: 0.13,
          direccion: 'San Salvador',
          razon: 'Razon',
          nit: '123456789',
          nrc: '1234',
          contactos: '234567890',
          domain_email: 'mail.helixsys.dev',
          sender_email: 'facturacion-electronica@mail.helixsys.dev',
          token_email: 'token123',
          version_email: '2',
        },
      });
      await this.prisma.facturasBloques.createMany({
        data: [
          {
            tira: 'N/A',
            autorizacion: 'AU001',
            resolucion: 'RE001',
            desde: 1,
            hasta: 2000000,
            actual: 1,
            serie: 'DTE-11-ABCDEFGH-00000',
            fecha_creacion: new Date('2024-06-08T16:21:42.663Z'),
            id_tipo_factura: 9,
            id_sucursal: 1,
            estado: 'ACTIVO',
          },
          {
            tira: 'N/A',
            autorizacion: 'AU001',
            resolucion: 'RE001',
            desde: 1,
            hasta: 2000000,
            actual: 1,
            serie: 'DTE-14-ABCDEFGH-00000',
            id_tipo_factura: 10,
            id_sucursal: 1,
            estado: 'ACTIVO',
          },
          {
            tira: 'N/A',
            autorizacion: 'AU001',
            resolucion: 'RE001',
            desde: 1,
            hasta: 2000000,
            actual: 1,
            serie: 'DTE-05-ABCDEFGH-00000',
            id_tipo_factura: 4,
            id_sucursal: 1,
            estado: 'ACTIVO',
          },
          {
            tira: 'N/A',
            autorizacion: 'AU001',
            resolucion: 'RE001',
            desde: 1,
            hasta: 2000000,
            actual: 2,
            serie: 'DTE-01-M001P001-00000',
            id_tipo_factura: 1,
            id_sucursal: 1,
            estado: 'ACTIVO',
          },
          {
            tira: 'N/A',
            autorizacion: 'AU001',
            resolucion: 'RE001',
            desde: 1,
            hasta: 2000000,
            actual: 2,
            serie: 'DTE-03-M001P001-00000',
            id_tipo_factura: 2,
            id_sucursal: 1,
            estado: 'ACTIVO',
          },
        ],
      });
    } catch (error) {
      console.log(error);
    }
  }


}
