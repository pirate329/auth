import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';
import { Request } from 'express';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => req?.cookies?.refresh_token, // only from refresh_token cookie
      ]),

      ignoreExpiration: false,
      //   secretOrKey: configService.get<string>('JWT_REFRESH_SECRET')!,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET')!,
    });
  }

  async validate(payload: any, req: Request) {
    const { sub: userId, sid: sessionId } = payload;

    // Verify session exists in Redis
    const redis = this.redisService.getClient();
    const session = await redis.get(`session:${userId}:${sessionId}`);

    console.log(
      'Validating refresh token for userId:',
      userId,
      'sessionId:',
      sessionId,
      'Session found:',
      session,
    );
    if (!session) {
      throw new UnauthorizedException('Session expired or invalid');
    }

    // Return user object (attached to req.user)
    return {
      id: userId,
      sessionId: sessionId,
    };
  }
}

@Injectable()
export class RefreshTokenGuard extends AuthGuard('jwt-refresh') {}
