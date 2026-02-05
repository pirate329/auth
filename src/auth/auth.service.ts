import { ConflictException, ForbiddenException, Injectable, InternalServerErrorException, Query, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { QueryFailedError, Repository } from 'typeorm';
import { Session } from './entities/session.entity';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { AuthDto, LoginDto } from './dtos/auth.dto';
import { hash, verify } from 'argon2';
import { RedisService } from 'src/redis/redis.service';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
// import { UserPlan } from 'src/users/entities/user-plan.entity';
import { Plan } from 'src/plans/entities/plan.entity';


export type JwtTTL = JwtSignOptions['expiresIn'];
// const SESSION_TTL = 7 * 24 * 60 * 60; //chenge to env befire prod


@Injectable()
export class AuthService {
    private accessSecret: string;
    private refreshSecret: string;
    private accessTTL: JwtTTL;
    private refreshTTL: JwtTTL;
    private redisSessionTTL: number;

    constructor(
        @InjectRepository(User) private userRepo: Repository<User>,
        @InjectRepository(Session) private sessionRepo: Repository<Session>,
        @InjectRepository(Plan) private planRepo: Repository<Plan>,
        private jwtService: JwtService,
        private redisService: RedisService,
        private configService: ConfigService,
    ) {
    this.accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET')!;
    this.refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET')!;
    this.accessTTL = this.configService.get<JwtTTL>('JWT_ACCESS_TTL')!;
    this.refreshTTL = this.configService.get<JwtTTL>('JWT_REFRESH_TTL')!;
    this.redisSessionTTL = this.configService.get<number>('REDIS_SESSION_TTL')!;

        if (!this.accessSecret || !this.refreshSecret) {
          throw new Error('Check your envs')
        }
    }
    

async signup(
  dto: AuthDto,
  userAgent: string,
  ipAddress: string
): Promise<{ success: boolean; accessToken: string; refreshToken: string , sessionId: string}> {
  try {
    const passwordHash = await hash(dto.password);

    const user = this.userRepo.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email.toLowerCase(),
      passwordHash: passwordHash,
    });

    const savedUser = await this.userRepo.save(user);

    // Assign default plan if none
    if (!savedUser.plan_type) {
      const defaultPlan = await this.planRepo.findOne({ 
        where: { name: 'Basic' } 
      });
      

      if (defaultPlan) {
        savedUser.plan_type = defaultPlan;
        const assignPlan = await this.userRepo.save(savedUser);
      }
    }

    const sessionId = randomUUID();
    const deviceId =  randomUUID(); // In real scenario, get this from client(fingerprinting) or generate based on user-agent + IP


    const accessToken = this.jwtService.sign(
      { sub: savedUser.id, sid: sessionId },
      { expiresIn: this.accessTTL, secret: this.accessSecret },

    );

    const refreshToken = this.jwtService.sign(
      { sub: savedUser.id, sid: sessionId },
      { expiresIn: this.refreshTTL, secret: this.refreshSecret },
    );

    const refreshTokenHash = await hash(refreshToken);


    // Save to postgres for history audit
    const session = this.sessionRepo.create({
      id: sessionId, 
      user: savedUser,
      deviceId: deviceId,
      refreshTokenHash: refreshTokenHash,
      ipAddress: ipAddress,
      userAgent: userAgent,
      lastActive: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const savedSession = await this.sessionRepo.save(session);

    const redis = this.redisService.getClient();

    const sessionData = {
      userId: savedUser.id,
      deviceId: deviceId,
      sessionId: savedSession.id,
      ipAddress: ipAddress,
      userAgent: userAgent,
      refreshTokenHash: refreshTokenHash,
      lastActive: new Date().toISOString(),
    };

   
    await redis.setex(
      `session:${savedUser.id}:${sessionId}`,
      this.redisSessionTTL,
      JSON.stringify(sessionData),
    );

    await redis.sadd(`user:sessions:${savedUser.id}`, sessionId);
    await redis.expire(`user:sessions:${savedUser.id}`, this.redisSessionTTL);


    return {
      success: true,
      accessToken: accessToken,
      refreshToken: refreshToken,
      sessionId: savedSession.id
    };
  } catch (error) {
    if (error instanceof QueryFailedError) {
      const pgError = error as any;

      // 23505 is the Postgres error code for unique violation
      if (pgError.code === '23505') {
        throw new ConflictException('Email already in use');
      }
    }

    console.error('Signup error:', error);
    throw new InternalServerErrorException('Signup failed');
  }
}


async login(
  dto: LoginDto,
  ipAddress: string,
  userAgent: string,
): Promise<{ accessToken: string; refreshToken: string, sessionId: string }> {

  const user = await this.userRepo.findOne({
    where: { email: dto.email.toLowerCase() },
    relations: ['plan_type'],
  });

  if (!user) throw new UnauthorizedException('Invalid credentials');

  const valid = await verify(user.passwordHash, dto.password);
  if (!valid) throw new UnauthorizedException('Invalid credentials');

  const deviceLimit = user.plan_type?.deviceLimit || 1;

  const redis = this.redisService.getClient();
  const activeSessionCount = await redis.scard(`user:sessions:${user.id}`);

  if (activeSessionCount >= deviceLimit) {
    throw new ForbiddenException(
      'Device limit exceeded. Please logout from another device first.'
    );
  }

  const sessionId = randomUUID();
  const deviceId = randomUUID(); 


  const accessToken = this.jwtService.sign(
    { sub: user.id, sid: sessionId },
    { expiresIn: this.accessTTL, secret: this.accessSecret },
  );

  const refreshToken = this.jwtService.sign(
    { sub: user.id, sid: sessionId },
    { expiresIn: this.refreshTTL, secret: this.refreshSecret },
  );

  const refreshTokenHash = await hash(refreshToken);

  // Save to PostgreSQL (for history/audit)
  const session = this.sessionRepo.create({
    id: sessionId,
    user,
    deviceId,
    refreshTokenHash,
    ipAddress,
    userAgent,
    lastActive: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const savedSession = await this.sessionRepo.save(session);

  const sessionData = {
    userId: user.id,
    sessionId: savedSession.id,
    deviceId,
    ipAddress,
    userAgent,
    refreshTokenHash,
    lastActive: new Date().toISOString(),
  };

  await redis.setex(
    `session:${user.id}:${sessionId}`,
    this.redisSessionTTL,
    JSON.stringify(sessionData),
  );

  await redis.sadd(`user:sessions:${user.id}`, sessionId);
  await redis.expire(`user:sessions:${user.id}`, this.redisSessionTTL);

  return { accessToken, refreshToken, sessionId: savedSession.id };
}


async me(userId: string) {
  const user = await this.userRepo.findOne({
    where: { id: userId },
    select: ['id', 'firstName', 'lastName', 'email', 'plan_type', 'createdAt'],
    relations: ['plan_type'],
  });

  return user;
}



async getSessions(userId: string) {
  const redis = this.redisService.getClient();
  const sessionIds = await redis.smembers(`user:sessions:${userId}`);

  const sessions: string[] = [];
  for (const sid of sessionIds) {
    const sessionData = await redis.get(`session:${userId}:${sid}`);
    if (sessionData) {
      sessions.push(JSON.parse(sessionData));
    } else {
      // Optiona but, clean up stale session IDs
      await redis.srem(`user:sessions:${userId}`, sid);
    }
  }

  return sessions;
}


async logout(userId: string, sessionId: string) {
  const redis = this.redisService.getClient();

  // Remove from Redis
  await redis.del(`session:${userId}:${sessionId}`);
  await redis.srem(`user:sessions:${userId}`, sessionId);

  // Mark as revoked in PostgreSQL
  await this.sessionRepo.update(
    { id: sessionId },
    { revoked: true, lastActive: new Date() }
  );
}



async logoutAll(userId: string) {
  const redis = this.redisService.getClient();

  // Get all sessions
  const sessionIds = await redis.smembers(`user:sessions:${userId}`);

  // Remove from Redis
  const pipeline = redis.pipeline();
  sessionIds.forEach(sid => {
    pipeline.del(`session:${userId}:${sid}`);
  });
  pipeline.del(`user:sessions:${userId}`);
  await pipeline.exec();

  // Revoke all in PostgreSQL
  await this.sessionRepo.update(
    { user: { id: userId }, revoked: false },
    { revoked: true, lastActive: new Date() }
  );
}



  async refreshTokens(
    userId: string,
    refreshToken: string,
    oldSessionId: string,
  ): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
    const redis = this.redisService.getClient();

    // 1. Load session from Redis
    const sessionDataRaw = await redis.get(`session:${userId}:${oldSessionId}`);
    if (!sessionDataRaw) {
      // console.log('No session data found in Redis for', `session:${userId}:${oldSessionId}`);
      throw new UnauthorizedException('Session not found or expired');
    }




    const sessionData = JSON.parse(sessionDataRaw);


    // console.log('Session Data from Redis:', sessionData);

    const isValid = await verify(sessionData.refreshTokenHash, refreshToken);
    if (!isValid) {
      throw new ForbiddenException('Invalid refresh token');
    }

    const user = await this.userRepo.findOne({ where: { id: userId }, relations: ['plan_type'] });
    if (!user) throw new UnauthorizedException('User not found');

    const newSessionId = randomUUID();
    const newRefreshToken = this.jwtService.sign(
      { sub: user.id, sid: newSessionId },
      { expiresIn: this.refreshTTL, secret: this.refreshSecret },
    );
    const newAccessToken = this.jwtService.sign(
      { sub: user.id, sid: newSessionId },
      { expiresIn: this.accessTTL, secret: this.accessSecret },
    );
    const newRefreshTokenHash = await hash(newRefreshToken);

    const session = this.sessionRepo.create({
      id: newSessionId,
      user,
      deviceId: sessionData.deviceId,
      refreshTokenHash: newRefreshTokenHash,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      lastActive: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await this.sessionRepo.save(session);

    const newSessionData = {
      userId: user.id,
      sessionId: newSessionId,
      deviceId: sessionData.deviceId,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      refreshTokenHash: newRefreshTokenHash,
      lastActive: new Date().toISOString(),
    };

    await redis.setex(
      `session:${user.id}:${newSessionId}`,
      7 * 24 * 60 * 60,
      JSON.stringify(newSessionData),
    );
    await redis.sadd(`user:sessions:${user.id}`, newSessionId);
    await redis.expire(`user:sessions:${user.id}`, this.redisSessionTTL);

    await redis.del(`session:${user.id}:${oldSessionId}`);
    await redis.srem(`user:sessions:${user.id}`, oldSessionId);
    await this.sessionRepo.update({ id: oldSessionId }, { revoked: true, lastActive: new Date() });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      sessionId: newSessionId,
    };
  }


}
