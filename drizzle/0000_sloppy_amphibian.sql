CREATE TABLE "model_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"category" varchar(16) NOT NULL,
	"description" text,
	"model_url" text NOT NULL,
	"cloudinary_model_public_id" text NOT NULL,
	"thumbnail_url" text,
	"cloudinary_thumbnail_public_id" text,
	"file_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_assets_cloudinary_model_public_id_unique" UNIQUE("cloudinary_model_public_id")
);
--> statement-breakpoint
CREATE INDEX "model_assets_category_created_at_idx" ON "model_assets" USING btree ("category","created_at");