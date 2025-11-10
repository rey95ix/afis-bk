import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CatalogosService {
  constructor(private readonly prisma: PrismaService) {}

  async getDiagnosticos() {
    return this.prisma.diagnostico_catalogo.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async getSoluciones() {
    return this.prisma.solucion_catalogo.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async getMotivosCierre() {
    return this.prisma.motivo_cierre_catalogo.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async getTecnicos() {
    // Retorna usuarios que pueden ser técnicos (ajustar según lógica de roles)
    return this.prisma.usuarios.findMany({
      where: {
        estado: 'ACTIVO',
        // Aquí podrías filtrar por rol de técnico si tienes esa lógica
        // roles: { nombre: 'TECNICO' }
      },
      select: {
        id_usuario: true,
        nombres: true,
        apellidos: true,
        usuario: true,
        dui: true,
      },
      orderBy: {
        nombres: 'asc',
      },
    });
  }

  async getTiposOrden() {
    // Retorna los tipos de orden como enums
    return [
      { value: 'INCIDENCIA', label: 'Incidencia' },
      { value: 'INSTALACION', label: 'Instalación' },
      { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
      { value: 'REUBICACION', label: 'Reubicación' },
      { value: 'RETIRO', label: 'Retiro' },
      { value: 'MEJORA', label: 'Mejora' },
    ];
  }

  async getEstadosOrden() {
    // Retorna los estados de orden como enums
    return [
      { value: 'PENDIENTE_ASIGNACION', label: 'Pendiente de Asignación' },
      { value: 'ASIGNADA', label: 'Asignada' },
      { value: 'AGENDADA', label: 'Agendada' },
      { value: 'EN_RUTA', label: 'En Ruta' },
      { value: 'EN_PROGRESO', label: 'En Progreso' },
      { value: 'EN_ESPERA_CLIENTE', label: 'En Espera del Cliente' },
      { value: 'REPROGRAMADA', label: 'Reprogramada' },
      { value: 'COMPLETADA', label: 'Completada' },
      { value: 'CANCELADA', label: 'Cancelada' },
    ];
  }
}
