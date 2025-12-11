// src/modules/openai/openai.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenaiService } from './openai.service';
import { DuiAnalyzerService } from './dui-analyzer.service';

@Module({
  imports: [ConfigModule],
  providers: [OpenaiService, DuiAnalyzerService],
  exports: [OpenaiService, DuiAnalyzerService],
})
export class OpenaiModule {}
