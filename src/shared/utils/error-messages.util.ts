const USER_MESSAGES: Record<string, string> = {
  guild_member_not_found: "No encontré tu/este usuario en el servidor.",
  guild_settings_not_found: "No encontré la configuración de este servidor.",
  bot_permission_not_verified: "No pude verificar mis permisos en este servidor.",
  user_not_in_voice: "Tienes que estar en un canal de voz para usar este comando.",
  bot_voice_busy: "Ya estoy hablando en otro canal. Espera a que termine, nyaha~.",
  voice_connection_failed: "No pude conectarme al canal de voz. Intenta de nuevo.",
  bot_permission_not_enough: "No tengo permisos para mandar mensajes en ese canal.",
  guild_user_persist_failed: "Hubo un error al guardar tus datos. Intenta de nuevo.",
  guild_channel_persist_failed: "Hubo un error al guardar el canal. Intenta de nuevo.",
  guild_settings_persist_failed: "Hubo un error al guardar la configuración. Intenta de nuevo.",
  bot_voice_permission_not_enough: "No tengo permisos para unirme o hablar en ese canal de voz.",
  guild_not_configured: "Un administrador debe usar el comando `/settings` antes de poder usar esta interacción.",
};

const FALLBACK_MESSAGE = "Hubo un error inesperado. Si persiste, avisa a un administrador.";

export function getUserErrorMessage(code: string): string {
  return USER_MESSAGES[code] ?? FALLBACK_MESSAGE;
}
