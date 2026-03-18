import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from './shared/shared.module';
import { EnvService } from './shared/services/env.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [SharedModule],
      useFactory: (envService: EnvService) => ({
        type: envService.dbType as 'mysql',
        host: envService.dbHost,
        port: envService.dbPort,
        username: envService.dbUsername,
        password: envService.dbPassword,
        database: envService.dbDatabase,
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
      }),
      inject: [EnvService],
    }),
  ],
})
export class TypeormModule {}
