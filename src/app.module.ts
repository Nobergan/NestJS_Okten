import { Module } from '@nestjs/common';
import { TablesModule } from './tables/tables.module';
import { TypeormModule } from './typeorm.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from './shared/shared.module';
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from './shared/filters/global-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TablesModule,
    TypeormModule,
    AuthModule,
    SharedModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
