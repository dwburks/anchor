import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

class TagChangeDto {
  @IsString()
  id: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  color?: string;

  @IsString()
  @IsOptional()
  updatedAt?: string;

  @IsOptional()
  isDeleted?: boolean;
}

export class SyncTagsDto {
  @IsString()
  @IsOptional()
  lastSyncedAt?: string;

  @IsArray()
  @ArrayMaxSize(500) // Prevent OOM from massive sync payloads
  @ValidateNested({ each: true })
  @Type(() => TagChangeDto)
  @IsOptional()
  changes?: TagChangeDto[];
}
