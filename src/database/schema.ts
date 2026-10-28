import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const MODEL_CATEGORIES = [
  'avatar',
  'hat',
  'shirt',
  'pant',
  'shoes',
  'necklace',
] as const;

export type ModelCategory = (typeof MODEL_CATEGORIES)[number];

export const modelAssets = pgTable(
  'model_assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    category: varchar('category', { length: 16 })
      .$type<ModelCategory>()
      .notNull(),
    description: text('description'),
    modelUrl: text('model_url').notNull(),
    cloudinaryModelPublicId: text('cloudinary_model_public_id')
      .notNull()
      .unique(),
    thumbnailUrl: text('thumbnail_url'),
    cloudinaryThumbnailPublicId: text('cloudinary_thumbnail_public_id'),
    fileSize: integer('file_size').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('model_assets_category_created_at_idx').on(table.category, table.createdAt)],
);

export type ModelAsset = typeof modelAssets.$inferSelect;
