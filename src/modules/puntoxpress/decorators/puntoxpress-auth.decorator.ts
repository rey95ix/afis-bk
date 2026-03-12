import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

export function PuntoXpressAuth() {
  return applyDecorators(
    UseGuards(AuthGuard('jwt-puntoxpress')),
    ApiBearerAuth('puntoxpress-auth'),
    ApiUnauthorizedResponse({
      description: 'No autenticado - Token inválido, expirado o integrador inactivo',
    }),
  );
}
