import type { channelPurpose } from "@infrastructure/database/schema/guild.schema.js";

export type ChannelPurpose = (typeof channelPurpose.enumValues)[number];
