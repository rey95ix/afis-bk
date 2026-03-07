import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorador para marcar endpoints como públicos (sin autenticación)
 *
 * Uso:
 * @Public()
 * @Post('login')
 * login(@Body() dto: ClienteLoginDto) {
 *   return this.authService.login(dto);
 * }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
