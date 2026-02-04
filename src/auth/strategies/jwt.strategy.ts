import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
super({
  jwtFromRequest: ExtractJwt.fromExtractors([
    ExtractJwt.fromAuthHeaderAsBearerToken(), // extracts from Authorization header
    (req) => req?.cookies?.access_token,      // extracts from cookie
  ]),

  ignoreExpiration: false,
  secretOrKey: configService.get<string>('JWT_ACCESS_SECRET')!, // note the `!` at the end
});

  }

  async validate(payload: any) {
    const { sub: userId, sid: sessionId } = payload;

    // Verify session exists in Redis
    const redis = this.redisService.getClient();
    const session = await redis.get(`session:${userId}:${sessionId}`);

    if (!session) {
      throw new UnauthorizedException('Session expired or invalid');
    }

    // Return user object (attached to req.user)
    return { 
      id: userId, 
      sessionId: sessionId 
    };
  }
}


@Injectable()
export class AccessTokenGuard extends AuthGuard('jwt') {}
