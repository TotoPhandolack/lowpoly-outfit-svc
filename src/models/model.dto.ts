import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { MODEL_CATEGORIES, type ModelCategory } from '../database/schema';

export class ListModelsQueryDto {
  @ApiPropertyOptional({ enum: MODEL_CATEGORIES })
  @IsOptional()
  @IsIn(MODEL_CATEGORIES)
  category?: ModelCategory;
}

export class UploadModelDto {
  @ApiProperty({ description: 'Display name shown in the outfit catalog' })
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiProperty({ enum: MODEL_CATEGORIES })
  @IsIn(MODEL_CATEGORIES)
  category!: ModelCategory;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class ModelResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: MODEL_CATEGORIES })
  category!: ModelCategory;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty({ format: 'uri', description: 'Cloudinary-hosted GLB file URL' })
  modelUrl!: string;

  @ApiPropertyOptional({ format: 'uri', nullable: true })
  thumbnailUrl!: string | null;

  @ApiProperty({ minimum: 1, description: 'Original GLB size in bytes' })
  fileSize!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}
