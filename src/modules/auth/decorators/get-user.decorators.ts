import { ExecutionContext, InternalServerErrorException, createParamDecorator } from "@nestjs/common";

export const GetUser = createParamDecorator(
    (data, ctx: ExecutionContext) => {
        const req = ctx.switchToHttp().getRequest();
        const user = req.user;
        if(!user)
            throw new InternalServerErrorException('Usuario no encontrado')

        // Si se especifica un campo específico, devolver solo ese campo
        if (data) {
            return user[data];
        }

        // Si no se especifica campo, devolver el usuario completo
        return user;
    }
);