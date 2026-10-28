import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

function createDatabase(sql: ReturnType<typeof postgres>) {
  return drizzle(sql, { schema });
}

type AppDatabase = ReturnType<typeof createDatabase>;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly sql: ReturnType<typeof postgres> | null;
  private readonly client: AppDatabase | null;

  constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (connectionString) {
      this.sql = postgres(connectionString, {
        max: 5,
        idle_timeout: 20,
        connect_timeout: 10,
        prepare: false,
      });
      this.client = createDatabase(this.sql);
    } else {
      this.sql = null;
      this.client = null;
    }
  }

  get database(): AppDatabase {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Database is not configured. Set DATABASE_URL to enable the model catalog.',
      );
    }
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.sql) await this.sql.end({ timeout: 5 });
  }
}
