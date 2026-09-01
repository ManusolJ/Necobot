const USER_MESSAGES: Record<string, string> = {
  guild_member_not_found: "No encontré tu/este usuario en el servidor.",
  target_excluded: "Este usuario esta excluido de las actividades del bot.",
  target_is_bot: "Los bots no sentimos nada, nyaha~. Busca a alguien de carne y hueso.",
  image_too_large: "Esa imagen pesa demasiado para mis ojos divinos. Máximo 8 MB.",
  bot_permission_not_verified: "No pude verificar mis permisos en este servidor.",
  user_not_in_voice: "Tienes que estar en un canal de voz para usar este comando.",
  bot_voice_busy: "Ya estoy hablando en otro canal. Espera a que termine, nyaha~.",
  voice_connection_failed: "No pude conectarme al canal de voz. Intenta de nuevo.",
  bot_permission_not_enough: "No tengo permisos para mandar mensajes en ese canal.",
  guild_user_persist_failed: "Hubo un error al guardar tus datos. Intenta de nuevo.",
  guild_channel_persist_failed: "Hubo un error al guardar el canal. Intenta de nuevo.",
  guild_settings_persist_failed: "Hubo un error al guardar la configuración. Intenta de nuevo.",
  bot_voice_permission_not_enough: "No tengo permisos para unirme o hablar en ese canal de voz.",
  invalid_image_attachment: "Eso no es una imagen que yo pueda mirar. Solo acepto PNG, JPG o WEBP.",
  guild_not_configured: "Un administrador debe usar el comando `/settings` antes de poder usar esta interacción.",
  user_excluded: "Estás excluido de las actividades del bot, nyaha~. Habla con un admin si crees que es un error.",
};

export const FALLBACK_MESSAGE = "Hubo un error inesperado. Si persiste, avisa a un administrador.";

export function getUserErrorMessage(code: string): string {
  return USER_MESSAGES[code] ?? FALLBACK_MESSAGE;
}
