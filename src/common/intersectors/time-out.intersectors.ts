import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, timeout } from "rxjs";


@Injectable()
export class TimeOutIntersector implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
        throw next.handle().pipe(timeout(30000));
    }

}