import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class PuntoXpressAuthGuard extends AuthGuard('jwt-puntoxpress') {}
