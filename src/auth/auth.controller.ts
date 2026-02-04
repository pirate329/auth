import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthDto, LoginDto } from './dtos/auth.dto';
import { AuthService } from './auth.service';
import { getClientIp } from 'src/helper/ip-helper';
import { RateLimit, RateLimitGuard } from 'src/common/gaurds/rate-limit.guard';
import { AuthGuard } from '@nestjs/passport';
import { AccessTokenGuard } from './strategies/jwt.strategy';
import { RefreshTokenGuard } from './strategies/jwt-refresh-strategy';

@UseGuards(RateLimitGuard)
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}


  @Post('signup')
  // 3 signup attempts per 10 minutes
  @RateLimit({ points: 3, duration: 600, keyPrefix: 'signup' })
  async signup(@Body() dto: AuthDto, @Req() req: any,   @Res({ passthrough: true }) res: any ){
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const ip = getClientIp(req);
    

    const {accessToken, refreshToken, success, sessionId}= await this.authService.signup(dto, userAgent, ip);



    res.cookie('access_token', accessToken, {
      httpOnly: false, // Set to true in production to prevent client-side access
      secure: false, // Set to true in production with HTTPS
      sameSite: 'lax', // or 'strict'
      // maxAge: 15 * 60 * 1000, // 15 minutes
        maxAge: 60 * 1000, // 1 minute
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: false, // Set to true in production to prevent client-side access
      secure: false, // Set to true in production with HTTPS
      sameSite: 'lax', // or 'strict'
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return { success, sessionId};

  }


  @Post('login')
  //  5 login attempts per 5 minutes
  @RateLimit({ points: 5, duration: 300, keyPrefix: 'login' })
  async login(@Body() dto: LoginDto, @Req() req: any, res: any) {
  const userAgent = req.headers['user-agent'] || 'Unknown';
    const ip = getClientIp(req);
    const {accessToken, refreshToken, sessionId} = await this.authService.login(dto, ip, userAgent);


    res.cookie('access_token', accessToken, {
      httpOnly: false, // Set to true in production to prevent client-side access
      secure: false, // Set to true in production with HTTPS
      sameSite: 'lax', // or 'strict'
      // maxAge: 15 * 60 * 1000, // 15 minutes
        maxAge: 60 * 1000, // 1 minute

    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      sameSite: 'strict', // or 'lax'
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return { accessToken , sessionId};
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  async me(@Req() req: any) {
    const userId = req.user?.id;
    console.log('Me endpoint accessed by user ID:', userId);
    return this.authService.me(userId);
  }


@Post('refresh')
@UseGuards(RefreshTokenGuard)
async refresh(@Req() req: any, @Res({ passthrough: true }) res: any) {
  const userId = req.user?.id;
  const sessionId = req.user?.sessionId;

  // Get old refresh token from cookie
  const oldRefreshToken = req.cookies?.refresh_token;

  // console.log('Refresh endpoint:', userId, sessionId, oldRefreshToken);

  const { accessToken, refreshToken } = await this.authService.refreshTokens(userId, oldRefreshToken, sessionId);

  // Set new tokens as cookies
  res.cookie('access_token', accessToken, {
    httpOnly: false,
    secure: false,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000, // 15 min
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/auth/refresh',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return { accessToken, refreshToken, sessionId };
}



  @Get('sessions')
  @UseGuards(AccessTokenGuard)
  async getSessions(@Req() req: any) {
    const userId = req.user?.id;
    return this.authService.getSessions(userId);
  }

  @Post('logout')
  async logout(@Req() req: any) {
    const userId = req.user?.id;
    const sessionId = req.user?.sid;
    return this.authService.logout(userId, sessionId);
  }

  @Post('logout-all')
  async logoutAll(@Req() req: any) {
    const userId = req.user?.id;
    return this.authService.logoutAll(userId);
  }



}
