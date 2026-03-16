import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EnvService {
  public readonly jwtSecret: string;
  public readonly accessTokenExpirationTime: number;
  public readonly refreshTokenExpirationTime: number;

  public readonly dbType: string;
  public readonly dbHost: string;
  public readonly dbPort: number;
  public readonly dbUsername: string;
  public readonly dbPassword: string;
  public readonly dbDatabase: string;

  constructor(private configService: ConfigService) {
    this.jwtSecret = configService.get<string>(
      'JWT_SECRET',
      '6ae9f277fc66f1f5d3387960fff22a3b9d56edae25f6b2a3e79b94eb4f6e5917017fa46732d1022a',
    );
    this.accessTokenExpirationTime = configService.get<number>(
      'ACCESS_TOKEN_EXPIRATION_TIME',
      600,
    );
    this.refreshTokenExpirationTime = configService.get<number>(
      'REFRESH_TOKEN_EXPIRATION_TIME',
      1200,
    );

    this.dbType = configService.get<string>('DB_TYPE', 'mysql');
    this.dbHost = configService.get<string>('DB_HOST', 'localhost');
    this.dbPort = configService.get<number>('DB_PORT', 3307);
    this.dbUsername = configService.get<string>('DB_USERNAME', 'user');
    this.dbPassword = configService.get<string>('DB_PASSWORD', 'user');
    this.dbDatabase = configService.get<string>(
      'DB_DATABASE',
      'my-nestjs-test',
    );
  }
}
