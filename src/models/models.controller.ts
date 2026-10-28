import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { MODEL_CATEGORIES } from '../database/schema';
import { AdminTokenGuard } from './admin-token.guard';
import {
  ListModelsQueryDto,
  ModelResponseDto,
  UploadModelDto,
} from './model.dto';
import { ModelsService } from './models.service';

@ApiTags('models')
@ApiExtraModels(ModelResponseDto)
@Controller('models')
export class ModelsController {
  constructor(private readonly models: ModelsService) {}

  @Get()
  @ApiOperation({ summary: 'List the available 3D clothing models' })
  @ApiQuery({ name: 'category', required: false, enum: [...MODEL_CATEGORIES] })
  @ApiOkResponse({
    description: 'The model catalog.',
    schema: {
      type: 'object',
      required: ['data'],
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(ModelResponseDto) },
        },
      },
    },
  })
  async list(@Query() query: ListModelsQueryDto) {
    return { data: await this.models.list(query.category) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one model by its ID' })
  @ApiOkResponse({
    description: 'The requested model.',
    schema: {
      type: 'object',
      required: ['data'],
      properties: { data: { $ref: getSchemaPath(ModelResponseDto) } },
    },
  })
  @ApiNotFoundResponse({ description: 'No model exists with this ID.' })
  async get(@Param('id', new ParseUUIDPipe()) id: string) {
    return { data: await this.models.get(id) };
  }

  @Post()
  @UseGuards(AdminTokenGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'model', maxCount: 1 },
        { name: 'thumbnail', maxCount: 1 },
      ],
      { limits: { fileSize: 50 * 1024 * 1024 } },
    ),
  )
  @ApiBearerAuth('adminToken')
  @ApiOperation({ summary: 'Upload a GLB model and save its metadata' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['model', 'name', 'category'],
      properties: {
        model: { type: 'string', format: 'binary', description: 'GLB file, up to 50 MB' },
        thumbnail: { type: 'string', format: 'binary', description: 'Optional JPEG, PNG, or WebP image, up to 5 MB' },
        name: { type: 'string', maxLength: 120 },
        category: { type: 'string', enum: [...MODEL_CATEGORIES] },
        description: { type: 'string', maxLength: 500 },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'The uploaded model record.',
    schema: {
      type: 'object',
      required: ['data'],
      properties: { data: { $ref: getSchemaPath(ModelResponseDto) } },
    },
  })
  async upload(
    @Body() dto: UploadModelDto,
    @UploadedFiles()
    files?: {
      model?: Express.Multer.File[];
      thumbnail?: Express.Multer.File[];
    },
  ) {
    const modelFile = files?.model?.[0];
    if (!modelFile) {
      throw new BadRequestException('A GLB file is required in the model field.');
    }
    return {
      data: await this.models.upload(dto, modelFile, files?.thumbnail?.[0]),
    };
  }

  @Delete(':id')
  @UseGuards(AdminTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('adminToken')
  @ApiOperation({ summary: 'Delete a model record and its Cloudinary assets' })
  @ApiNoContentResponse({ description: 'The model was deleted.' })
  @ApiNotFoundResponse({ description: 'No model exists with this ID.' })
  async delete(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.models.delete(id);
  }
}
