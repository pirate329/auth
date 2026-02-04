import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './redis/redis.module';
import { PlansModule } from './plans/plans.module';
import { SeedService } from './common/seed/seed.service';

@Module({
  imports: [AuthModule, UsersModule, TypeOrmModule.forRoot({

    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'foobarpassword',
    database: 'arm_auth',
    autoLoadEntities: true,
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    synchronize: true, // Note: set to false in production
  }), ConfigModule.forRoot({
    isGlobal: true,
  }), RedisModule, PlansModule],
  controllers: [AppController],
  providers: [AppService, SeedService],
})


export class AppModule {}
