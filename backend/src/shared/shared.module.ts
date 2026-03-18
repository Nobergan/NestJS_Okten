import { Module } from '@nestjs/common';
import { EnvService } from './services/env.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [EnvService],
  exports: [EnvService],
})
export class SharedModule {}
