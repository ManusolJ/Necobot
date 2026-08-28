import type { Client } from "discord.js";
import type { RESTPostAPIApplicationCommandsJSONBody } from "discord.js";
import type { RESTGetAPIApplicationCommandsResult } from "discord-api-types/v10";

import { Routes } from "discord.js";

function applicationId(client: Client): string {
  if (client.application === null) {
    throw new Error("Client application is not available yet");
  }

  return client.application.id;
}

export async function fetchGlobalCommands(client: Client): Promise<RESTGetAPIApplicationCommandsResult> {
  const result = await client.rest.get(Routes.applicationCommands(applicationId(client)));

  return result as RESTGetAPIApplicationCommandsResult;
}

export async function fetchGuildCommands(
  client: Client,
  guildId: string,
): Promise<RESTGetAPIApplicationCommandsResult> {
  const result = await client.rest.get(Routes.applicationGuildCommands(applicationId(client), guildId));

  return result as RESTGetAPIApplicationCommandsResult;
}

export async function syncGlobalsToGuild(client: Client, guildId: string): Promise<string[]> {
  const global = await fetchGlobalCommands(client);

  const body: RESTPostAPIApplicationCommandsJSONBody[] = global.map(
    ({ id: _id, application_id: _appId, version: _version, guild_id: _guildId, ...data }) =>
      data as RESTPostAPIApplicationCommandsJSONBody,
  );

  await client.rest.put(Routes.applicationGuildCommands(applicationId(client), guildId), { body });

  return body.map((command) => command.name);
}

export async function purgeGuildCommands(client: Client, guildId: string): Promise<string[]> {
  const existing = await fetchGuildCommands(client, guildId);

  if (existing.length === 0) {
    return [];
  }

  await client.rest.put(Routes.applicationGuildCommands(applicationId(client), guildId), { body: [] });

  return existing.map((command) => command.name);
}
