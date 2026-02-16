import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginThrottleService } from './login-throttle.service';
import { AuditService } from '../audit/audit.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { User } from 'src/generated/prisma/client';
import type { Request } from 'express';

@Controller('api/auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginThrottleService: LoginThrottleService,
    private readonly auditService: AuditService,
  ) {}

  @Get('registration-mode')
  getRegistrationMode() {
    return this.authService.getRegistrationMode();
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const throttleKey = `${loginDto.email}::${ip}`;

    // Check if this email/IP combo is locked out
    this.loginThrottleService.checkAttempt(throttleKey);

    try {
      const result = await this.authService.login(loginDto);
      // Clear failed attempts on success
      this.loginThrottleService.recordSuccess(throttleKey);
      this.auditService.log({
        action: 'login',
        actor: loginDto.email,
        ipAddress: ip,
      });
      return result;
    } catch (error) {
      // Only record failure for auth errors (invalid credentials), not other errors like pending accounts
      const isAuthError =
        error instanceof Error &&
        (error.message === 'Invalid credentials' ||
          (error as any)?.response?.message === 'Invalid credentials');
      if (isAuthError) {
        this.loginThrottleService.recordFailure(throttleKey);
        this.auditService.log({
          action: 'login_failed',
          actor: loginDto.email,
          ipAddress: ip,
        });
      }
      throw error;
    }
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto.refresh_token);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: User) {
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('api-token')
  getApiToken(@CurrentUser() user: User) {
    return this.authService.getApiToken(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('api-token')
  revokeApiToken(@CurrentUser() user: User) {
    return this.authService.revokeApiToken(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('api-token/regenerate')
  regenerateApiToken(@CurrentUser() user: User) {
    return this.authService.regenerateApiToken(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: User,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, changePasswordDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: User,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.id, updateProfileDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile/image')
  @UseInterceptors(FileInterceptor('image'))
  async uploadProfileImage(
    @CurrentUser() user: User,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({
            fileType: /(image\/jpeg|image\/png|image\/webp)/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.authService.uploadProfileImage(user.id, file);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('profile/image')
  async removeProfileImage(@CurrentUser() user: User) {
    return this.authService.removeProfileImage(user.id);
  }
}
