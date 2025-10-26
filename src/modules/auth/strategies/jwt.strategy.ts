import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { JwtPayload } from "../interfaces/jwt-payload.interface";
import { ConfigService } from "@nestjs/config";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "src/modules/prisma/prisma.service";


@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private prisma: PrismaService,
        configService: ConfigService
    ) {
        super({
            secretOrKey: configService.get('JWT_SECRET'),
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
        });
    }
    async validate(payload: JwtPayload): Promise<any> {
        const { id_usuario } = payload;
        const user = await this.prisma.usuarios.findFirst({ where: { id_usuario } });
        if (!user) throw new UnauthorizedException('Token no valido')
        if (user.estado == 'INACTIVO') throw new UnauthorizedException('Token no valido')

        return user;
    }

}