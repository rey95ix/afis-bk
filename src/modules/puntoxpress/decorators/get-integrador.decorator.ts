import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetIntegrador = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const integrador = request.user;

    if (data) {
      return integrador?.[data];
    }

    return integrador;
  },
);
