import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { type ModelCategory, modelAssets } from '../database/schema';
import { CloudinaryService } from './cloudinary.service';
import type { UploadModelDto } from './model.dto';

const MAX_MODEL_SIZE = 50 * 1024 * 1024;
const MAX_THUMBNAIL_SIZE = 5 * 1024 * 1024;
const ALLOWED_MODEL_MIME_TYPES = new Set([
  'model/gltf-binary',
  'application/octet-stream',
]);
const ALLOWED_THUMBNAIL_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

@Injectable()
export class ModelsService {
  private readonly logger = new Logger(ModelsService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async list(category?: ModelCategory) {
    const db = this.database.database;
    const records = await db.query.modelAssets.findMany({
      where: category ? eq(modelAssets.category, category) : undefined,
      orderBy: [desc(modelAssets.createdAt)],
    });
    return records.map((record) => this.toResponse(record));
  }

  async get(id: string) {
    const [record] = await this.database.database
      .select()
      .from(modelAssets)
      .where(eq(modelAssets.id, id))
      .limit(1);
    if (!record) throw new NotFoundException('Model not found.');
    return this.toResponse(record);
  }

  async upload(
    dto: UploadModelDto,
    modelFile: Express.Multer.File,
    thumbnailFile?: Express.Multer.File,
  ) {
    this.assertValidModel(modelFile);
    if (thumbnailFile) this.assertValidThumbnail(thumbnailFile);

    const id = randomUUID();
    let modelUpload: Awaited<ReturnType<CloudinaryService['uploadModel']>> | null = null;
    let thumbnailUpload: Awaited<ReturnType<CloudinaryService['uploadThumbnail']>> | null = null;

    try {
      modelUpload = await this.cloudinary.uploadModel(modelFile.buffer, id);
      if (thumbnailFile) {
        thumbnailUpload = await this.cloudinary.uploadThumbnail(
          thumbnailFile.buffer,
          id,
        );
      }

      const [record] = await this.database.database
        .insert(modelAssets)
        .values({
          id,
          name: dto.name.trim(),
          category: dto.category,
          description: dto.description?.trim() || null,
          modelUrl: modelUpload.secure_url,
          cloudinaryModelPublicId: modelUpload.public_id,
          thumbnailUrl: thumbnailUpload?.secure_url ?? null,
          cloudinaryThumbnailPublicId: thumbnailUpload?.public_id ?? null,
          fileSize: modelFile.size,
        })
        .returning();

      return this.toResponse(record);
    } catch (error) {
      await Promise.allSettled([
        ...(modelUpload
          ? [this.cloudinary.deleteModel(modelUpload.public_id)]
          : []),
        ...(thumbnailUpload
          ? [this.cloudinary.deleteThumbnail(thumbnailUpload.public_id)]
          : []),
      ]);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    this.cloudinary.assertAvailable();
    const [record] = await this.database.database
      .delete(modelAssets)
      .where(eq(modelAssets.id, id))
      .returning();
    if (!record) throw new NotFoundException('Model not found.');

    const removals = [
      this.cloudinary.deleteModel(record.cloudinaryModelPublicId),
      ...(record.cloudinaryThumbnailPublicId
        ? [this.cloudinary.deleteThumbnail(record.cloudinaryThumbnailPublicId)]
        : []),
    ];
    const results = await Promise.allSettled(removals);
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.warn(`The model record was deleted, but Cloudinary cleanup failed: ${String(result.reason)}`);
      }
    }
  }

  private assertValidModel(file: Express.Multer.File): void {
    if (!file) throw new BadRequestException('A GLB file is required in the model field.');
    if (file.size > MAX_MODEL_SIZE) {
      throw new BadRequestException('GLB files must be 50 MB or smaller.');
    }
    if (!file.originalname.toLowerCase().endsWith('.glb')) {
      throw new BadRequestException('Only .glb model files are supported.');
    }
    if (!ALLOWED_MODEL_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('The model file must use a supported GLB content type.');
    }
    if (file.buffer.subarray(0, 4).toString('ascii') !== 'glTF') {
      throw new BadRequestException('The uploaded file does not have a valid GLB header.');
    }
  }

  private assertValidThumbnail(file: Express.Multer.File): void {
    if (file.size > MAX_THUMBNAIL_SIZE) {
      throw new BadRequestException('Thumbnail images must be 5 MB or smaller.');
    }
    if (!ALLOWED_THUMBNAIL_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Thumbnails must be JPEG, PNG, or WebP images.');
    }
  }

  private toResponse(record: typeof modelAssets.$inferSelect) {
    return {
      id: record.id,
      name: record.name,
      category: record.category,
      description: record.description,
      modelUrl: record.modelUrl,
      thumbnailUrl: record.thumbnailUrl,
      fileSize: record.fileSize,
      createdAt: record.createdAt,
    };
  }
}
