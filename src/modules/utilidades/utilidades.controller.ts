import {
  Controller,
  Post, 
} from '@nestjs/common';
import {
  ApiTags, 
} from '@nestjs/swagger';
import { ImportDataService } from './import-data.service';  

@ApiTags('Utilidades') 
@Controller('utilidades')
export class UtilidadesController {
  constructor(private readonly importDataService: ImportDataService) {}

  @Post('mysql/connect')  
  async connectToMysql( ) {
    return await this.importDataService.connectToMysql( );
  }  

  @Post('mysql/import-table') 
  async importTable( 
  ) {
    return await this.importDataService.importTable( 
    );
  }
}
