export const DUEL_NOT_FOR_YOU = "Este duelo no va contigo, metiche. Consigue tu propio drama, nyaha~.";

export const DUEL_ALREADY_CHOSE = "Ya elegiste. Nada de cambiar de opinión, tramposo.";

export const DUEL_CHOICE_REGISTERED = "Elección registrada. Ahora a esperar al rival... qué tensión, nyaha~.";

export const DUEL_INVITE_TIMEOUT: readonly string[] = [
  "{target} ni se ha dignado a responder. {challenger}, acepta la indirecta. Duelo cancelado, puntos devueltos.",
  "Cinco minutos esperando y nada. {challenger}, te han dejado en visto. {target}, cobarde. Duelo cancelado.",
];

export const DUEL_DENIED: readonly string[] = [
  "{target} ha rechazado el duelo. La cobardía también es una estrategia, supongo. {challenger}, puntos devueltos.",
  "{target} dice que no. {challenger}, tu reputación de matón queda intacta... tu aburrimiento también.",
];

export const DUEL_TARGET_BROKE: readonly string[] = [
  "{target} no tiene ni **{bet}** puntos. No puedes desplumar a quien ya está desplumado, {challenger}.",
  "Duelo cancelado: {target} está en la ruina. Apostar contra la pobreza es de mal gusto, nyaha~.",
];

export const DUEL_DRAW: readonly string[] = [
  "🤝 Empate. Los dos habéis elegido lo mismo. Qué originales. Puntos devueltos, y mi tiempo perdido.",
  "🤝 Empate... el resultado más aburrido posible. Tomad vuestros puntos y pensad en lo que habéis hecho.",
];

export const DUEL_WIN: readonly string[] = [
  "⚔️ {winnerChoice} aplasta a {loserChoice}. {winner} se lleva **{amount}** puntos y {loser} se lleva una lección.",
  "⚔️ {winner} gana con {winnerChoice} contra {loserChoice}. **{amount}** puntos cambian de manos. {loser}, F.",
];

export const DUEL_NO_CHOICE_BOTH: readonly string[] = [
  "⏱️ NINGUNO ha elegido. Cinco minutos mirándoos como pasmarotes. Os quedáis sin apuesta los dos, par de indecisos.",
];

export const DUEL_NO_CHOICE_ONE: readonly string[] = [
  "⏱️ {slacker} no ha elegido en cinco minutos y pierde su apuesta de **{bet}** puntos por indeciso. {chooser} recupera la suya.",
];

export const DUEL_BOT_WIN: readonly string[] = [
  "{userChoice} gana a {botChoice}. Vale, {user}, me has ganado. Toma tu **{reward}** punto. Sí, UNO. Inflación.",
  "{user} me ha ganado con {userChoice}. Disfruta tu **{reward}** punto, campeón. Enmarca este momento.",
];

export const DUEL_BOT_LOSE: readonly string[] = [
  "Mi {botChoice} destroza tu {userChoice}. ¿De verdad pensabas que podías ganarme, {user}? Nyaha~ adorable.",
  "{botChoice} > {userChoice}. Perder contra un bot en piedra papel tijera... duerme con eso si puedes, {user}.",
];

export const DUEL_BOT_DRAW: readonly string[] = [
  "🤝 Empate, {user}. Grandes mentes piensan igual... o tu mediocridad es contagiosa. Quién sabe.",
];

export const DUEL_BOT_TIMEOUT: readonly string[] = [
  "⏱️ ¿Me retas a duelo y luego no eliges nada, {user}? Cinco minutos de mi vida. Increíble.",
];
