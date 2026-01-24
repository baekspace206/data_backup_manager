import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1737007000000 implements MigrationInterface {
  name = 'InitialSchema1737007000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type
    await queryRunner.query(`CREATE TYPE "file_type_enum" AS ENUM('image', 'video')`);

    // Create file_metadata table
    await queryRunner.query(`
      CREATE TABLE "file_metadata" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "originalName" character varying(512) NOT NULL,
        "mimeType" character varying(100) NOT NULL,
        "size" bigint NOT NULL,
        "uploadDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        "filePath" character varying(1024) NOT NULL,
        "fileType" "file_type_enum" NOT NULL,
        "checksum" character varying(64),
        "thumbnailPath" character varying(1024),
        "metadata" jsonb,
        "tags" character varying(100),
        "description" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_file_metadata_id" PRIMARY KEY ("id")
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX "IDX_file_metadata_uploadDate" ON "file_metadata" ("uploadDate")`);
    await queryRunner.query(`CREATE INDEX "IDX_file_metadata_fileType" ON "file_metadata" ("fileType")`);
    await queryRunner.query(`CREATE INDEX "IDX_file_metadata_originalName" ON "file_metadata" ("originalName")`);
    await queryRunner.query(`CREATE INDEX "IDX_file_metadata_checksum" ON "file_metadata" ("checksum")`);
    await queryRunner.query(`CREATE INDEX "IDX_file_metadata_isActive" ON "file_metadata" ("isActive")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_file_metadata_isActive"`);
    await queryRunner.query(`DROP INDEX "IDX_file_metadata_checksum"`);
    await queryRunner.query(`DROP INDEX "IDX_file_metadata_originalName"`);
    await queryRunner.query(`DROP INDEX "IDX_file_metadata_fileType"`);
    await queryRunner.query(`DROP INDEX "IDX_file_metadata_uploadDate"`);

    // Drop table
    await queryRunner.query(`DROP TABLE "file_metadata"`);

    // Drop enum type
    await queryRunner.query(`DROP TYPE "file_type_enum"`);
  }
}