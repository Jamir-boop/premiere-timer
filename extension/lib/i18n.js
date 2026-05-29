export const LANGUAGE_AUTO = "auto";
export const DEFAULT_LANGUAGE = "en";
export const SUPPORTED_LANGUAGES = ["en", "es"];
export const LANGUAGE_PREFERENCES = [LANGUAGE_AUTO, ...SUPPORTED_LANGUAGES];

export const MESSAGES = {
  en: {
    about: "About",
    accentColor: "Accent color",
    actionTitleWithStatus: "premiere-timer: {status}",
    allowSteamAccess: "Allow Steam access",
    appName: "premiere-timer",
    ago: "{value} ago",
    author: "Author",
    colorsReset: "Colors reset.",
    colorsSaved: "Colors saved.",
    configureShortcuts: "Configure shortcuts",
    configSaved: "Config saved.",
    currentCSRating: "Current CS Rating",
    currentStatus: "Current status",
    csRating: "CS Rating",
    csRatingInvalid: "CS Rating must be a number from 0 to 99999.",
    estimatedExpiry: "Estimated expiry",
    expired: "expired",
    fetchError: "Fetch error",
    fetchStatus: "Fetch status",
    githubButton: "GitHub",
    badgeCounter: "Icon day counter",
    language: "Language",
    languageAuto: "Auto",
    languageEnglish: "English",
    languageSpanish: "Español",
    lastSync: "Last sync",
    latestMatchStatus: "Latest match status",
    latestPremier: "Latest Premier",
    latestPremierMatchInvalid: "Latest Premier match time is invalid.",
    latestPremierMatchLocalTime: "Latest Premier match local time",
    loading: "Loading",
    local: "Local",
    loginRequired: "Login required",
    manual: "Manual",
    manualMatchTimeSaved: "Manual match time saved.",
    manualRatingSaved: "Manual rating saved.",
    missing: "Missing",
    missingData: "Missing data",
    moreData: "More data",
    never: "Never",
    noPremierMatchFound: "No Premier match found",
    now: "now",
    onTrack: "On track",
    openSidebar: "Open sidebar",
    openSteamGcpd: "Open Steam GCPD",
    openedSteamGcpdPages: "Opened Steam GCPD pages. Leave them open until sync finishes.",
    openingRepository: "Opening GitHub",
    openingShortcutSettings: "Opening shortcut settings",
    openingSidebar: "Opening sidebar",
    openingSteamGcpd: "Opening Steam GCPD",
    openSupportedSteamGcpd: "Open supported Steam GCPD page first.",
    optionalPanels: "Optional panels",
    pastSafePlayWindow: "Past safe play window",
    pickLatestPremierMatchTime: "Pick latest Premier match time.",
    playBefore: "Play Premier before {value}",
    ratingNotFoundManual: "Steam rating not found. Use manual fallback.",
    ratingSource: "Rating source",
    ratingStatus: "Rating status",
    refresh: "Refresh",
    refreshingSteam: "Refreshing Steam",
    repositoryOpened: "GitHub opened.",
    requestUnknown: "Unknown request.",
    accentColorInvalid: "Accent color must be a hex color.",
    requestingSteamAccess: "Requesting Steam access",
    resetAccentColor: "Reset accent color",
    resettingColors: "Resetting colors",
    safePlayWindow: "Safe play window",
    save: "Save",
    savingColors: "Saving colors",
    savingConfig: "Saving config",
    savingLatestMatch: "Saving latest match",
    savingRating: "Saving rating",
    settings: "Settings",
    settingsNote: "Use the main button to sync Steam data. If Steam asks you to sign in, leave the opened GCPD tabs open until sync finishes.",
    setupDescription: "Tracks Premier rating expiry from Steam Personal Game Data. Browser must be logged into Steam. No Steam password, no backend.",
    setupTitle: "Setup",
    shortcutSettingsOpened: "Shortcut settings opened.",
    sidebarOpened: "Sidebar opened.",
    sidebarUnavailable: "Sidebar is not available in this browser.",
    statusEmpty: "Empty",
    statusError: "Error",
    statusNeedsLogin: "Needs login",
    statusNever: "Never",
    statusNoPermission: "No permission",
    statusNoPremierMatches: "No Premier matches",
    statusOk: "OK",
    statusRatingNotFound: "Rating not found",
    steamAccessAllowed: "Steam access allowed",
    steamAccessAllowedNext: "Steam access allowed. Sync Steam data next.",
    steamAccessDenied: "Steam access denied.",
    steamAccessNotAllowed: "Steam access not allowed.",
    steamAccessPending: "Steam access pending",
    steamDataRefreshed: "Steam data refreshed.",
    steamLoginRequired: "Steam login required. Open GCPD while logged in.",
    steamMatchmaking: "Steam matchmaking",
    steamStatus: "Steam status: {status}",
    steamSyncNeeded: "Steam sync needed.",
    stepAccess: "Allow Steam access",
    stepReady: "Timer ready",
    stepSync: "Sync Steam data",
    syncSteamData: "Sync Steam data",
    syncSteamRating: "Sync Steam rating",
    timezone: "Timezone",
    under24h: "Under 24h",
    under72h: "Under 72h",
    updateCsRatingAfterLatestMatch: "Update CS Rating after latest match",
    updateRating: "Update rating",
    useManualTime: "Use manual time",
    version: "Version"
  },
  es: {
    about: "Acerca de",
    accentColor: "Color de acento",
    actionTitleWithStatus: "premiere-timer: {status}",
    allowSteamAccess: "Permitir acceso a Steam",
    appName: "premiere-timer",
    ago: "hace {value}",
    author: "Autor",
    colorsReset: "Colores restablecidos.",
    colorsSaved: "Colores guardados.",
    configureShortcuts: "Configurar atajos",
    configSaved: "Configuración guardada.",
    currentCSRating: "CS Rating actual",
    currentStatus: "Estado actual",
    csRating: "CS Rating",
    csRatingInvalid: "CS Rating debe ser un número de 0 a 99999.",
    estimatedExpiry: "Vencimiento estimado",
    expired: "vencido",
    fetchError: "Error de consulta",
    fetchStatus: "Estado de consulta",
    githubButton: "GitHub",
    badgeCounter: "Contador de días en icono",
    language: "Idioma",
    languageAuto: "Auto",
    languageEnglish: "English",
    languageSpanish: "Español",
    lastSync: "Última sync",
    latestMatchStatus: "Estado de última partida",
    latestPremier: "Última Premier",
    latestPremierMatchInvalid: "Hora de última partida Premier no válida.",
    latestPremierMatchLocalTime: "Hora local de última partida Premier",
    loading: "Cargando",
    local: "Local",
    loginRequired: "Login requerido",
    manual: "Manual",
    manualMatchTimeSaved: "Hora manual guardada.",
    manualRatingSaved: "Rating manual guardado.",
    missing: "Falta",
    missingData: "Faltan datos",
    moreData: "Más datos",
    never: "Nunca",
    noPremierMatchFound: "No se encontró partida Premier",
    now: "ahora",
    onTrack: "En orden",
    openSidebar: "Abrir barra lateral",
    openSteamGcpd: "Abrir Steam GCPD",
    openedSteamGcpdPages: "Páginas Steam GCPD abiertas. Déjalas abiertas hasta terminar la sync.",
    openingRepository: "Abriendo GitHub",
    openingShortcutSettings: "Abriendo configuración de atajos",
    openingSidebar: "Abriendo barra lateral",
    openingSteamGcpd: "Abriendo Steam GCPD",
    openSupportedSteamGcpd: "Abre primero una página Steam GCPD compatible.",
    optionalPanels: "Paneles opcionales",
    pastSafePlayWindow: "Ventana segura vencida",
    pickLatestPremierMatchTime: "Elige la hora de la última partida Premier.",
    playBefore: "Juega Premier antes de {value}",
    ratingNotFoundManual: "Steam rating no encontrado. Usa fallback manual.",
    ratingSource: "Fuente de rating",
    ratingStatus: "Estado de rating",
    refresh: "Actualizar",
    refreshingSteam: "Actualizando Steam",
    repositoryOpened: "GitHub abierto.",
    requestUnknown: "Solicitud desconocida.",
    accentColorInvalid: "Color de acento debe ser un color hex.",
    requestingSteamAccess: "Pidiendo acceso a Steam",
    resetAccentColor: "Restablecer color de acento",
    resettingColors: "Restableciendo colores",
    safePlayWindow: "Ventana segura",
    save: "Guardar",
    savingColors: "Guardando colores",
    savingConfig: "Guardando configuración",
    savingLatestMatch: "Guardando última partida",
    savingRating: "Guardando rating",
    settings: "Config",
    settingsNote: "Usa el botón principal para sincronizar datos de Steam. Si Steam pide iniciar sesión, deja abiertas las pestañas GCPD hasta que termine la sync.",
    setupDescription: "Rastrea el vencimiento del rating Premier desde Steam Personal Game Data. El navegador debe tener sesión iniciada en Steam. Sin contraseña de Steam, sin backend.",
    setupTitle: "Setup",
    shortcutSettingsOpened: "Configuración de atajos abierta.",
    sidebarOpened: "Barra lateral abierta.",
    sidebarUnavailable: "Barra lateral no disponible en este navegador.",
    statusEmpty: "Vacío",
    statusError: "Error",
    statusNeedsLogin: "Necesita login",
    statusNever: "Nunca",
    statusNoPermission: "Sin permiso",
    statusNoPremierMatches: "Sin partidas Premier",
    statusOk: "OK",
    statusRatingNotFound: "Rating no encontrado",
    steamAccessAllowed: "Acceso a Steam permitido",
    steamAccessAllowedNext: "Acceso a Steam permitido. Sincroniza datos de Steam.",
    steamAccessDenied: "Acceso a Steam denegado.",
    steamAccessNotAllowed: "Acceso a Steam no permitido.",
    steamAccessPending: "Acceso a Steam pendiente",
    steamDataRefreshed: "Datos de Steam actualizados.",
    steamLoginRequired: "Login de Steam requerido. Abre GCPD con sesión iniciada.",
    steamMatchmaking: "Steam matchmaking",
    steamStatus: "Estado de Steam: {status}",
    steamSyncNeeded: "Falta sync de Steam.",
    stepAccess: "Permitir acceso a Steam",
    stepReady: "Timer listo",
    stepSync: "Sincronizar datos de Steam",
    syncSteamData: "Sincronizar datos de Steam",
    syncSteamRating: "Sincronizar rating de Steam",
    timezone: "Zona horaria",
    under24h: "Menos de 24h",
    under72h: "Menos de 72h",
    updateCsRatingAfterLatestMatch: "Actualiza CS Rating después de la última partida",
    updateRating: "Actualiza rating",
    useManualTime: "Usar hora manual",
    version: "Versión"
  }
};

const TIMER_LABEL_KEYS = {
  expired: "pastSafePlayWindow",
  ok: "onTrack",
  stale_rating: "updateRating",
  unknown: "missingData",
  urgent: "under24h",
  warning: "under72h"
};

const BADGE_TITLE_KEYS = {
  expired: "pastSafePlayWindow",
  ok: "onTrack",
  stale_rating: "updateCsRatingAfterLatestMatch",
  unknown: "missingData",
  urgent: "under24h",
  warning: "under72h"
};

export function normalizeLanguagePreference(value) {
  return LANGUAGE_PREFERENCES.includes(value) ? value : LANGUAGE_AUTO;
}

export function getBrowserLanguageCandidates(extra = []) {
  const navigatorLanguages = Array.isArray(globalThis.navigator?.languages)
    ? globalThis.navigator.languages
    : [];
  return [
    ...extra,
    ...navigatorLanguages,
    globalThis.navigator?.language
  ].filter((value) => typeof value === "string" && value.trim());
}

export function resolveLanguage(preference = LANGUAGE_AUTO, browserLanguages = getBrowserLanguageCandidates()) {
  const normalized = normalizeLanguagePreference(preference);
  if (SUPPORTED_LANGUAGES.includes(normalized)) {
    return normalized;
  }

  for (const candidate of browserLanguages) {
    const base = candidate.toLowerCase().split("-")[0];
    if (SUPPORTED_LANGUAGES.includes(base)) {
      return base;
    }
  }

  return DEFAULT_LANGUAGE;
}

export function createTranslator(preference = LANGUAGE_AUTO, browserLanguages = getBrowserLanguageCandidates()) {
  const language = resolveLanguage(preference, browserLanguages);
  return {
    language,
    preference: normalizeLanguagePreference(preference),
    t(key, values = {}) {
      const template = MESSAGES[language]?.[key] ?? MESSAGES[DEFAULT_LANGUAGE]?.[key] ?? key;
      return template.replace(/\{([^}]+)\}/g, (_, name) => String(values[name] ?? ""));
    }
  };
}

export function timerLabel(level, translator) {
  return translator.t(TIMER_LABEL_KEYS[level] ?? "missingData");
}

export function badgeTitle(level, translator) {
  return translator.t(BADGE_TITLE_KEYS[level] ?? "missingData");
}
