// import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
// import { Observable } from 'rxjs';
// import { map, tap } from 'rxjs/operators';
// import { Tracer, ExplicitContext, BatchRecorder, Annotation, jsonEncoder } from 'zipkin';
// import { HttpLogger } from 'zipkin-transport-http';

// @Injectable()
// export class ZipkinInterceptorcustom implements NestInterceptor {
//   private readonly tracer: Tracer;

//   constructor() {
//     const ctxImpl = new ExplicitContext();
//     const recorder = new BatchRecorder({
//       logger: new HttpLogger({
//         endpoint: `http://localhost:9411/api/v2/spans`,
//         jsonEncoder: jsonEncoder.JSON_V2,
//       }),
//     });

//     this.tracer = new Tracer({
//       ctxImpl,
//       recorder,
//       localServiceName: "nestjs-service", // Nombre del servicio en Zipkin
//     });
//   }

//   intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
//     const httpContext = context.switchToHttp();
//     const request = httpContext.getRequest();
//     const response = httpContext.getResponse();
//     const method = request.method;
//     const url = request.url;

//     const traceId = this.tracer.createRootId();
//     this.tracer.setId(traceId);

//     const startTime = process.hrtime();

//     // Añadir información básica de la solicitud
//     this.tracer.recordAnnotation(new Annotation.ServerRecv());
//     this.tracer.recordServiceName('nestjs-service');
//     this.tracer.recordRpc(method);
//     this.tracer.recordBinary('http.url', url);
//     this.tracer.recordBinary('http.method', method);
//     this.tracer.recordBinary('http.headers', JSON.stringify(request.headers));

//     // Opcional: Añadir el cuerpo de la solicitud si no es demasiado grande
//     if (request.body && Object.keys(request.body).length > 0) {
//       this.tracer.recordBinary('http.request_body', JSON.stringify(request.body));
//     }

//     return next.handle().pipe( 
//       map((responseBody) => {
//         // Guardar el cuerpo de la respuesta en la traza
//         console.log('Guardar el cuerpo de la respuesta en la traza');
//         console.log('responseBody====================');
//         console.log(responseBody);
//         if (responseBody && Object.keys(responseBody).length > 0) {
//           this.tracer.recordBinary('http.response_body', JSON.stringify(responseBody));
//         }
//         return responseBody;
//       }),
//       tap({ // Ejecutar al finalizar la solicitud
//         error: () => {
//           console.log('error====================');
//           const [seconds, nanoseconds] = process.hrtime(startTime);
//           const durationMs = seconds * 1000 + nanoseconds / 1e6;

//           this.tracer.setId(traceId);

//           // Capturar el código de estado de la respuesta
//           const statusCode = Number(response.statusCode);
//           console.log('statusCode====================',statusCode);
//           // Solo registrar la traza si es un error (códigos 4xx o 5xx)
//           if (statusCode >= 400 && statusCode < 600) {
//             this.tracer.recordBinary('http.status_code', statusCode.toString());
//             this.tracer.recordBinary('http.response_headers', JSON.stringify(response.getHeaders()));
//             this.tracer.recordBinary('http.duration_ms', durationMs.toFixed(3));

//             this.tracer.recordAnnotation(new Annotation.ServerSend());
//           }
//         },
//         complete: () => {
//           console.log('completeee====================');
//           // const [seconds, nanoseconds] = process.hrtime(startTime);
//           // const durationMs = seconds * 1000 + nanoseconds / 1e6;

//           // this.tracer.setId(traceId);

//           // // Capturar el código de estado de la respuesta
//           // const statusCode = response.statusCode;

//           // // Solo registrar la traza si es un error (códigos 4xx o 5xx)
//           // if (statusCode >= 400 && statusCode < 600) {
//           //   this.tracer.recordBinary('http.status_code', statusCode.toString());
//           //   this.tracer.recordBinary('http.response_headers', JSON.stringify(response.getHeaders()));
//           //   this.tracer.recordBinary('http.duration_ms', durationMs.toFixed(3));

//           //   this.tracer.recordAnnotation(new Annotation.ServerSend());
//           // }
//         },
//       })
//     );
//   }
// }
