import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe , BadRequestException } from '@nestjs/common';
import { SeedService } from './common/seed/seed.service';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);


  //Use cookie parser
  app.use(cookieParser());

  // Enable cors
  app.enableCors({
    origin: "http://localhost:8081",
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  })

  

  // Seed plan data
  const seedService = app.get(SeedService);
  await seedService.seedPlans();

  // app.useGlobalPipes(new ValidationPipe())
  app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => {
      // Map errors with feilds
      const formatted = errors.map(err => ({
        field: err.property,
        errors: err.constraints ? Object.values(err.constraints) : [],
      }));
      return new BadRequestException({ errors: formatted });
    },  
  }),
);

  app.getHttpAdapter().getInstance().set('trust proxy', true);
  await app.listen(process.env.PORT ?? 3000);


}
bootstrap();
