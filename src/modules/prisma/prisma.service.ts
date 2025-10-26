import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        super({
            log: ['info','warn', 'error'],
        });
        // this.$use(loggingMiddleware());
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }

    // Método para ejecutar una consulta raw
    async executeRawQuery(query: string, params: any[]) {
        return this.$executeRawUnsafe(query, ...params);
    }

    // Método para ejecutar una consulta raw y obtener resultados
    async queryRaw(query: string, params: any[]) {
        return this.$queryRawUnsafe(query, ...params);
    }

    // Método para registrar en la bitácora
    async logAction(accion: string, id_usuario?: number, descripcion?: string) {
        return this.log.create({
            data: {
                accion,
                descripcion,
                id_usuario,
                fecha_creacion: new Date(),
            },
        });
    }
}

// export function loggingMiddleware(): Prisma.Middleware {
//     return async (params, next) => {
//         const before = Date.now();

//         // Ejecutar la consulta
//         const result = await next(params);

//         const after = Date.now();

//         console.log(`Query: ${params.model}.${params.action}`);
//         console.log(`Params: ${JSON.stringify(params.args)}`);
//         console.log(`Duration: ${after - before}ms`);

//         return result;
//     };
// }
