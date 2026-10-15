-- Global network mode (static IP ranges or DHCP) and per-instance live IP cache
ALTER TABLE "Settings" ADD COLUMN "networkMode" TEXT NOT NULL DEFAULT 'static';

ALTER TABLE "Instance" ADD COLUMN "networkMode" TEXT NOT NULL DEFAULT 'static';
ALTER TABLE "Instance" ADD COLUMN "lastKnownIp" TEXT;
ALTER TABLE "Instance" ADD COLUMN "lastIpSeenAt" DATETIME;
