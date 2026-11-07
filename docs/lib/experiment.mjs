export const STUDY_ID = "emospherepp-r-intensity-pilot-v1";
export const STORAGE_KEY = "emospherepp-pilot-v1-session";
export const MAX_PLAYS = 2;
export const EXPECTED_TRIALS = 9;

export function shuffled(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function validateConditions(input) {
  if (!Array.isArray(input) || input.length !== EXPECTED_TRIALS) {
    throw new Error("刺激リストは9件である必要があります。");
  }
  const ids = new Set();
  const files = new Set();
  for (const item of input) {
    if (!item || !/^[A-Z0-9]{5,12}$/.test(item.id)) {
      throw new Error("無効な刺激IDがあります。");
    }
    if (ids.has(item.id)) throw new Error("刺激IDが重複しています。");
    if (typeof item.audio !== "string" || !/^audio\/[a-z0-9_-]+\.wav$/.test(item.audio)) {
      throw new Error("音声パスが不正です。");
    }
    if (files.has(item.audio)) throw new Error("音声パスが重複しています。");
    if (typeof item.text !== "string" || !item.text.trim()) {
      throw new Error("提示文が未設定です。");
    }
    ids.add(item.id);
    files.add(item.audio);
  }
  return input;
}

export function makeSession(conditions, setup, idMaker, now) {
  validateConditions(conditions);
  return {
    studyId: STUDY_ID,
    participantId: "P-" + idMaker(),
    submissionId: "S-" + idMaker(),
    startedAt: now(),
    setup,
    order: shuffled(conditions.map((c) => c.id), secureRandom),
    index: 0,
    attempts: {},
    completions: {},
    responses: [],
    shownAt: now(),
    status: "in-progress"
  };
}

export function secureRandom() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] / 4294967296;
  }
  return Math.random();
}

export function validSession(session, conditions) {
  if (!session || session.studyId !== STUDY_ID || !Array.isArray(session.order)) return false;
  if (session.order.length !== EXPECTED_TRIALS || new Set(session.order).size !== EXPECTED_TRIALS) return false;
  const expected = new Set(conditions.map((c) => c.id));
  if (!session.order.every((id) => expected.has(id))) return false;
  if (!Number.isInteger(session.index) || session.index < 0 || session.index > EXPECTED_TRIALS) return false;
  if (!Array.isArray(session.responses) || session.responses.length !== session.index) return false;
  if (!["in-progress", "pending", "submitted"].includes(session.status)) return false;
  return true;
}

export function validRating(joy, naturalness) {
  return Number.isInteger(joy) && joy >= 1 && joy <= 7 &&
    Number.isInteger(naturalness) && naturalness >= 1 && naturalness <= 5;
}

export function validResponseList(responses) {
  if (!Array.isArray(responses) || responses.length !== EXPECTED_TRIALS) return false;
  const ids = new Set();
  for (const r of responses) {
    if (!r || typeof r.stimulusId !== "string" || ids.has(r.stimulusId)) return false;
    if (!validRating(r.joy, r.naturalness)) return false;
    if (!Number.isInteger(r.playCount) || r.playCount < 1 || r.playCount > MAX_PLAYS) return false;
    ids.add(r.stimulusId);
  }
  return true;
}
