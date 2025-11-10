import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import { Logger, ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/intersectors';
import { HEADER_API_BEARER_AUTH } from './common/const';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

let PORT = 3000;
let APP_URL = 'http://localhost';
let DB_URL = 'localhost';
let DB_PORT = 'localhost';
const logger = new Logger('IXC_API');
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Configurar archivos estáticos
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  app.useGlobalInterceptors(new TransformInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  const config = new DocumentBuilder()
    .setTitle('IXC API')
    .setDescription('The IXC API description')
    .setVersion('1.0')
    .addTag('ixc')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Ingrese el token JWT',
        in: 'header',
      },
      HEADER_API_BEARER_AUTH,
    )
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  app.enableCors();

  PORT = app.get(ConfigService).get('PORT') ?? PORT;
  APP_URL = app.get(ConfigService).get('APP_URL') ?? APP_URL;

  DB_PORT = app.get(ConfigService).get('DB_PORT') ?? DB_PORT;
  DB_URL = app.get(ConfigService).get('DB_HOST') ?? DB_URL;

  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
  await app.listen(PORT);
}
bootstrap()
  .then(() => logger.log('START API : ' + APP_URL + ':' + PORT))
  .then(() => logger.log('API DOC START : ' + APP_URL + ':' + PORT + '/api'))
  .then(() => logger.log('DB RUNNING ON : ' + DB_URL + ':' + DB_PORT))
  .catch((error) => logger.error('Error: ', error));
