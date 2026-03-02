-- Add Docker compatibility permissions and instance configuration
ALTER TABLE "Group" ADD COLUMN "allowDockerCompatibility" BOOLEAN NOT NULL DEFAULT 0;

ALTER TABLE "Instance" ADD COLUMN "dockerCompatibilityEnabled" BOOLEAN NOT NULL DEFAULT 0;

