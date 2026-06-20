export const REMINDER_OFFSET_MS = 24 * 60 * 60 * 1000;
export const SAFE_REMINDER_ALARM = "safe-deadline-reminder";
export const EXPIRY_REMINDER_ALARM = "expiry-deadline-reminder";

export const REMINDER_TYPES = {
  safe: {
    type: "safe",
    alarmName: SAFE_REMINDER_ALARM,
    deadlineField: "playBeforeAt",
    sentField: "safeReminderSentFor"
  },
  expiry: {
    type: "expiry",
    alarmName: EXPIRY_REMINDER_ALARM,
    deadlineField: "expirationAtEstimate",
    sentField: "expiryReminderSentFor"
  }
};

export function getReminderTypeByAlarm(alarmName) {
  return Object.values(REMINDER_TYPES).find((type) => type.alarmName === alarmName) || null;
}

export function getReminderKey(state, reminderType) {
  const config = resolveReminderType(reminderType);
  const deadlineAt = state?.[config.deadlineField];
  const deadlineTime = new Date(deadlineAt).getTime();
  if (!Number.isFinite(deadlineTime)) {
    return null;
  }

  return [
    deadlineAt,
    state.latestPremierMatchAt || "",
    state.currentRating ?? ""
  ].join("|");
}

export function getReminderPlan(state, reminderType, now = new Date()) {
  const config = resolveReminderType(reminderType);
  const deadlineAt = state?.[config.deadlineField];
  const deadlineTime = new Date(deadlineAt).getTime();

  if (!state?.remindersEnabled) {
    return { action: "none", reason: "disabled", type: config.type };
  }
  if (!Number.isFinite(deadlineTime)) {
    return { action: "none", reason: "missing_deadline", type: config.type };
  }

  const key = getReminderKey(state, config);
  if (state[config.sentField] === key) {
    return { action: "none", reason: "sent", type: config.type, key, deadlineAt };
  }

  const nowTime = now.getTime();
  if (!Number.isFinite(nowTime) || deadlineTime <= nowTime) {
    return { action: "none", reason: "deadline_passed", type: config.type, key, deadlineAt };
  }

  const reminderAtMs = deadlineTime - REMINDER_OFFSET_MS;
  const basePlan = {
    type: config.type,
    alarmName: config.alarmName,
    sentField: config.sentField,
    key,
    deadlineAt,
    reminderAtMs
  };

  if (reminderAtMs <= nowTime) {
    return { ...basePlan, action: "notify" };
  }

  return { ...basePlan, action: "schedule" };
}

export function getReminderPlans(state, now = new Date()) {
  return Object.values(REMINDER_TYPES).map((type) => getReminderPlan(state, type, now));
}

function resolveReminderType(reminderType) {
  const config = typeof reminderType === "string" ? REMINDER_TYPES[reminderType] : reminderType;
  if (!config) {
    throw new Error(`Unknown reminder type: ${reminderType}`);
  }
  return config;
}
