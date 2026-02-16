import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuditService } from '../audit/audit.service';
import { AdminGuard } from './admin.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateRegistrationModeDto } from './dto/update-registration-mode.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AuditService,
  ) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('settings/registration')
  getRegistrationSettings() {
    return this.adminService.getRegistrationSettings();
  }

  @Patch('settings/registration')
  async updateRegistrationMode(
    @CurrentUser('email') adminEmail: string,
    @Body() dto: UpdateRegistrationModeDto,
  ) {
    const result = await this.adminService.updateRegistrationMode(dto.mode);
    this.auditService.log({
      action: 'registration_mode_changed',
      actor: adminEmail,
      details: { mode: dto.mode },
    });
    return result;
  }

  @Get('users')
  findAllUsers(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.adminService.findAllUsers(
      skip ? parseInt(skip, 10) : 0,
      take ? parseInt(take, 10) : 50,
    );
  }

  @Get('users/pending')
  getPendingUsers() {
    return this.adminService.getPendingUsers();
  }

  @Post('users')
  async createUser(
    @CurrentUser('email') adminEmail: string,
    @Body() createUserDto: CreateUserDto,
  ) {
    const result = await this.adminService.createUser(createUserDto);
    this.auditService.log({
      action: 'user_created',
      actor: adminEmail,
      target: createUserDto.email,
    });
    return result;
  }

  @Patch('users/:id')
  async updateUser(
    @CurrentUser('email') adminEmail: string,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const result = await this.adminService.updateUser(id, updateUserDto);
    this.auditService.log({
      action: 'user_updated',
      actor: adminEmail,
      target: id,
      details: { ...updateUserDto },
    });
    return result;
  }

  @Delete('users/:id')
  async deleteUser(
    @CurrentUser('email') adminEmail: string,
    @Param('id') id: string,
  ) {
    const result = await this.adminService.deleteUser(id);
    this.auditService.log({
      action: 'user_deleted',
      actor: adminEmail,
      target: id,
    });
    return result;
  }

  @Post('users/:id/reset-password')
  async resetPassword(
    @CurrentUser('email') adminEmail: string,
    @Param('id') id: string,
    @Body() resetPasswordDto: ResetPasswordDto,
  ) {
    const result = await this.adminService.resetPassword(
      id,
      resetPasswordDto.newPassword,
    );
    this.auditService.log({
      action: 'password_reset',
      actor: adminEmail,
      target: id,
    });
    return result;
  }

  @Post('users/:id/approve')
  async approveUser(
    @CurrentUser('email') adminEmail: string,
    @Param('id') id: string,
  ) {
    const result = await this.adminService.approveUser(id);
    this.auditService.log({
      action: 'user_approved',
      actor: adminEmail,
      target: id,
    });
    return result;
  }

  @Post('users/:id/reject')
  async rejectUser(
    @CurrentUser('email') adminEmail: string,
    @Param('id') id: string,
  ) {
    const result = await this.adminService.rejectUser(id);
    this.auditService.log({
      action: 'user_rejected',
      actor: adminEmail,
      target: id,
    });
    return result;
  }

  @Get('audit-logs')
  getAuditLogs(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('action') action?: string,
    @Query('actor') actor?: string,
  ) {
    return this.auditService.findAll({
      skip: skip ? parseInt(skip, 10) : 0,
      take: take ? parseInt(take, 10) : 50,
      action,
      actor,
    });
  }
}
