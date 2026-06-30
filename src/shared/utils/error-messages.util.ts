const USER_MESSAGES: Record<string, string> = {
  guild_settings_not_found: "No encontré la configuración de este servidor.",
  guild_settings_persist_failed: "Hubo un error al guardar la configuración. Intenta de nuevo.",
  guild_not_configured: "Un administrador debe usar el comando `/settings` antes de poder usar esta interacción.",
  guild_user_persist_failed: "Hubo un error al guardar tus datos. Intenta de nuevo.",
};

const FALLBACK_MESSAGE = "Hubo un error inesperado. Si persiste, avisa a un administrador.";

export function getUserErrorMessage(code: string): string {
  return USER_MESSAGES[code] ?? FALLBACK_MESSAGE;
}
