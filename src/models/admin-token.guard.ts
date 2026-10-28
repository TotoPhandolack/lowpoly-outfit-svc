import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class AdminTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('API_ADMIN_TOKEN');
    if (!expected) {
      throw new ServiceUnavailableException(
        'Model writes are disabled. Configure API_ADMIN_TOKEN first.',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization ?? '';
    const supplied = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : '';
    const expectedBuffer = Buffer.from(expected);
    const suppliedBuffer = Buffer.from(supplied);
    if (
      suppliedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(suppliedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('A valid admin bearer token is required.');
    }

    return true;
  }
}
