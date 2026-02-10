import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsDateString,
  IsEnum,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SyncNoteState {
  active = 'active',
  trashed = 'trashed',
  deleted = 'deleted',
}

export class SyncNoteDto {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(500000) // ~500KB max note content
  content?: string;

  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @IsBoolean()
  @IsOptional()
  isArchived?: boolean;

  @IsString()
  @IsOptional()
  background?: string;

  @IsEnum(SyncNoteState)
  @IsOptional()
  state?: SyncNoteState;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];

  @IsDateString()
  updatedAt: string;
}

export class SyncNotesDto {
  @IsDateString()
  @IsOptional()
  lastSyncedAt?: string;

  @IsArray()
  @ArrayMaxSize(500) // Prevent OOM from massive sync payloads
  @ValidateNested({ each: true })
  @Type(() => SyncNoteDto)
  @IsOptional()
  changes?: SyncNoteDto[];
}
