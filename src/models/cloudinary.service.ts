import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiOptions, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly configured: boolean;
  private readonly folder: string;

  constructor(config: ConfigService) {
    const cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = config.get<string>('CLOUDINARY_API_SECRET');
    this.configured = Boolean(cloudName && apiKey && apiSecret);
    this.folder = (config.get<string>('CLOUDINARY_MODEL_FOLDER') ?? 'lowpoly-outfit/models')
      .replace(/^\/+|\/+$/g, '');

    if (this.configured) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
    }
  }

  async uploadModel(buffer: Buffer, modelId: string): Promise<UploadApiResponse> {
    const options: UploadApiOptions = {
      resource_type: 'raw',
      public_id: `${this.folder}/${modelId}.glb`,
      overwrite: false,
      unique_filename: false,
    };
    return this.upload(buffer, options);
  }

  async uploadThumbnail(buffer: Buffer, modelId: string): Promise<UploadApiResponse> {
    const options: UploadApiOptions = {
      resource_type: 'image',
      public_id: `${this.folder}/${modelId}-thumbnail`,
      overwrite: false,
      unique_filename: false,
    };
    return this.upload(buffer, options);
  }

  async deleteModel(publicId: string): Promise<void> {
    await this.delete(publicId, 'raw');
  }

  async deleteThumbnail(publicId: string): Promise<void> {
    await this.delete(publicId, 'image');
  }

  assertAvailable(): void {
    this.assertConfigured();
  }

  private async upload(
    buffer: Buffer,
    options: UploadApiOptions,
  ): Promise<UploadApiResponse> {
    this.assertConfigured();
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error('Cloudinary returned an empty upload result.'));
        resolve(result);
      });
      stream.end(buffer);
    });
  }

  private async delete(publicId: string, resourceType: 'raw' | 'image'): Promise<void> {
    this.assertConfigured();
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
    if (result.result !== 'ok' && result.result !== 'not found') {
      this.logger.warn(`Cloudinary did not confirm deletion of ${publicId}.`);
    }
  }

  private assertConfigured(): void {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'Cloudinary is not configured. Set the CLOUDINARY_* environment variables.',
      );
    }
  }
}
