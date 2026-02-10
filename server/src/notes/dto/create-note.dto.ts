import {
  IsBoolean,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsArray,
  MaxLength,
} from 'class-validator';

export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
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

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];
}
