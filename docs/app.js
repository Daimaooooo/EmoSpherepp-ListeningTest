import {
  STUDY_ID, STORAGE_KEY, MAX_PLAYS, EXPECTED_TRIALS,
  validateConditions, makeSession, validSession, validRating, validResponseList
} from "./lib/experiment.mjs";

const $ = (id) => document.getElementById(id);
const config = window.EXPERIMENT_CONFIG || { gasEndpoint: "" };
let conditions = [];
let conditionById = new Map();
let session = null;
let currentAudio = null;
let audioBusy = false;
let hasStorage = true;

function persist() {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    hasStorage = false;
    console.warn("Session storage unavailable", error);
  }
}

function retrieve() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    return validSession(parsed, conditions) ? parsed : null;
  } catch {
    hasStorage = false;
    return null;
  }
}

function show(section) {
  for (const name of ["intro", "trialScreen", "finish"]) {
    $(name).hidden = name !== section;
  }
  window.scrollTo({ top: 0, behavior: "instant" });
}

function notice(text, isError = false) {
  const element = $("systemNotice");
  element.hidden = !text;
  element.textContent = text;
  element.classList.toggle("error", isError);
}

function initScale(targetId, name, count) {
  const box = $(targetId);
  box.classList.toggle("five", count === 5);
  for (let number = 1; number <= count; number++) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = String(number);
    input.required = true;
    const span = document.createElement("span");
    span.textContent = String(number);
    label.append(input, span);
    box.append(label);
  }
}

function currentId() {
  return session.order[session.index];
}

function completed() {
  return session.completions[currentId()] || 0;
}

function attempts() {
  return session.attempts[currentId()] || 0;
}

function updatePlayUI() {
  const remaining = MAX_PLAYS - attempts();
  const canPlay = remaining > 0 && !audioBusy;
  $("playBtn").disabled = !canPlay;
  $("playBtn").textContent = audioBusy
    ? "再生中…"
    : remaining > 0
      ? "▶ 音声を再生（残り" + remaining + "回）"
      : "再生上限に達しました";
  $("playInfo").textContent =
    "最後まで再生：" + completed() + "回 / 再生開始：" + attempts() + "回（上限2回）";
  $("nextBtn").disabled = completed() < 1;
}

function renderTrial() {
  if (session.index >= EXPECTED_TRIALS) {
    renderFinish();
    return;
  }
  const item = conditionById.get(currentId());
  show("trialScreen");
  $("progressLabel").textContent = (session.index + 1) + " / " + EXPECTED_TRIALS;
  $("progressFill").style.width = (session.index / EXPECTED_TRIALS * 100) + "%";
  $("progressTrack").setAttribute("aria-valuenow", String(session.index));
  $("sentence").textContent = item.text;
  $("trialError").hidden = true;
  $("ratingForm").reset();

  const player = $("player");
  player.pause();
  player.removeAttribute("src");
  player.load();
  player.src = item.audio;
  currentAudio = item;
  audioBusy = false;
  // Reset time-on-task after a page reload or a deliberate resume.
  // Otherwise leaving the survey overnight produces invalid multi-hour RT.
  session.shownAt = Date.now();
  persist();
  updatePlayUI();
}

async function playCurrent() {
  if (!session || session.index >= EXPECTED_TRIALS || audioBusy || attempts() >= MAX_PLAYS) return;
  audioBusy = true;
  const id = currentId();
  session.attempts[id] = attempts() + 1;
  persist();
  updatePlayUI();
  const player = $("player");
  player.currentTime = 0;
  try {
    await player.play();
  } catch {
    session.attempts[id] = Math.max(0, (session.attempts[id] || 1) - 1);
    audioBusy = false;
    persist();
    updatePlayUI();
    $("trialError").textContent = "音声を再生できませんでした。通信状態と音量をご確認ください。";
    $("trialError").hidden = false;
  }
}

function recordRating(event) {
  event.preventDefault();
  if (!session || completed() < 1) return;
  const joy = Number(new FormData($("ratingForm")).get("joy"));
  const naturalness = Number(new FormData($("ratingForm")).get("naturalness"));
  if (!validRating(joy, naturalness)) {
    $("trialError").textContent = "両方の項目に回答してください。";
    $("trialError").hidden = false;
    return;
  }
  const id = currentId();
  session.responses.push({
    trialIndex: session.index + 1,
    stimulusId: id,
    joy,
    naturalness,
    playCount: completed(),
    playAttempts: attempts(),
    rtMs: Math.max(0, Date.now() - session.shownAt)
  });
  session.index++;
  session.shownAt = Date.now();
  persist();
  if (session.index === EXPECTED_TRIALS) {
    session.status = "pending";
    session.completedAt = new Date().toISOString();
    persist();
    renderFinish();
  } else {
    renderTrial();
  }
}

function isValidGAS(url) {
  return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url || "");
}

function isGASOrigin(origin) {
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "https:" &&
      (parsed.hostname === "script.google.com" ||
        parsed.hostname === "script.googleusercontent.com" ||
        parsed.hostname.endsWith(".googleusercontent.com"));
  } catch {
    return false;
  }
}

function submitToGAS(url, payload) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.name = "gas_reply_" + Math.random().toString(36).slice(2);
    const form = document.createElement("form");
    form.hidden = true;
    form.method = "POST";
    form.action = url;
    form.target = frame.name;
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "payload";
    input.value = JSON.stringify(payload);
    form.append(input);
    document.body.append(frame, form);

    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      form.remove();
      frame.remove();
    };
    const onMessage = (event) => {
      if (event.source !== frame.contentWindow || !isGASOrigin(event.origin)) return;
      const data = event.data;
      if (!data || data.type !== "EMOSPHERE_GAS_ACK" ||
        data.submissionId !== payload.submissionId) return;
      cleanup();
      if (data.ok === true) resolve(data);
      else reject(new Error("受信先で処理できませんでした。設定を確認してください。"));
    };
    window.addEventListener("message", onMessage);
    timer = setTimeout(() => {
      cleanup();
      reject(new Error("送信確認がタイムアウトしました。保存済みか不明です。再試行できます。"));
    }, 20000);
    try {
      form.submit();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

function setSubmissionStatus(message, isError = false) {
  const box = $("submissionStatus");
  box.textContent = message;
  box.classList.toggle("error", isError);
}

function renderFinish() {
  show("finish");
  $("participantId").textContent = session.participantId;
  if (session.status === "submitted") {
    setSubmissionStatus("回答の受信確認が完了しています。ありがとうございました！");
  } else if (!isValidGAS(config.gasEndpoint)) {
    setSubmissionStatus("確認モードです。回答の自動送信先が未設定のため、CSVを保存してください。");
  } else {
    setSubmissionStatus("回答はまだ受信確認されていません。「回答を送信する」を押してください。");
  }
  $("submitBtn").disabled = session.status === "submitted" ||
    !isValidGAS(config.gasEndpoint);
}

async function submitResponses() {
  if (!session || session.status === "submitted") return;
  if (!validResponseList(session.responses)) {
    setSubmissionStatus("回答件数または評価値に不整合があります。", true);
    return;
  }
  const button = $("submitBtn");
  button.disabled = true;
  setSubmissionStatus("回答を送信し、受信確認を待っています…");
  const payload = {
    studyId: STUDY_ID,
    submissionId: session.submissionId,
    participantId: session.participantId,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    setup: session.setup,
    order: session.order,
    responses: session.responses
  };
  try {
    await submitToGAS(config.gasEndpoint, payload);
    session.status = "submitted";
    session.submittedAt = new Date().toISOString();
    persist();
    setSubmissionStatus("受信先から保存完了の応答を受け取りました。ご協力ありがとうございました！");
  } catch (error) {
    session.status = "pending";
    persist();
    setSubmissionStatus("送信を確認できませんでした：" + error.message +
      " 同じ回答IDで再試行するか、CSVを保存してください。", true);
    button.disabled = false;
  }
}

function csvCell(value) {
  const s = String(value == null ? "" : value);
  const safe = /^[=+\-@]/.test(s) ? "'" + s : s;
  return '"' + safe.replace(/"/g, '""') + '"';
}

function downloadCSV() {
  if (!session || !validResponseList(session.responses)) return;
  const columns = [
    "study_id", "participant_id", "submission_id", "trial_index",
    "stimulus_id", "rating_joy", "rating_naturalness",
    "play_count", "play_attempts", "rt_ms", "device", "tts_experience"
  ];
  const lines = [columns.join(",")];
  for (const r of session.responses) {
    const fields = [
      STUDY_ID, session.participantId, session.submissionId,
      r.trialIndex, r.stimulusId, r.joy, r.naturalness, r.playCount,
      r.playAttempts, r.rtMs, session.setup.device, session.setup.ttsExperience
    ];
    lines.push(fields.map(csvCell).join(","));
  }
  const blob = new Blob(["\ufeff" + lines.join("\r\n") + "\r\n"], {
    type: "text/csv;charset=utf-8"
  });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = "emospherepp_" + session.participantId + ".csv";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function renderIntro() {
  show("intro");
  $("resumePanel").hidden = !session;
  $("startBtn").disabled = Boolean(session);
  if (session && session.status === "submitted") {
    $("resumeBtn").textContent = "送信済みの結果を表示";
  } else if (session) {
    $("resumeBtn").textContent = "前回の続きから再開";
  }
}

async function initialize() {
  initScale("joyScale", "joy", 7);
  initScale("naturalScale", "naturalness", 5);
  try {
    const response = await fetch("./conditions.json", { cache: "no-store" });
    if (!response.ok) throw new Error("刺激リストを取得できませんでした。");
    conditions = validateConditions(await response.json());
    conditionById = new Map(conditions.map((c) => [c.id, c]));
  } catch (error) {
    notice("実験を開始できません：" + error.message, true);
    $("startBtn").disabled = true;
    return;
  }
  session = retrieve();
  renderIntro();
  if (!isValidGAS(config.gasEndpoint)) {
    notice("現在は確認モードです。回答は外部へ自動送信されません。");
  } else if (!hasStorage) {
    notice("このブラウザでは進捗の保存ができません。途中でページを閉じないでください。", true);
  }

  $("startForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (session) return;
    if (config.requireHeadphones && $("device").value !== "headphones") {
      notice("この実験ではヘッドホン・イヤホンを選択してください。", true);
      return;
    }
    session = makeSession(
      conditions,
      { device: $("device").value, ttsExperience: $("ttsExperience").value },
      () => crypto.randomUUID(),
      () => new Date().toISOString()
    );
    session.shownAt = Date.now();
    persist();
    notice("");
    renderTrial();
  });
  $("resumeBtn").addEventListener("click", () => {
    if (!session) return;
    if (session.index === EXPECTED_TRIALS) renderFinish();
    else renderTrial();
  });
  $("resetBtn").addEventListener("click", () => {
    if (!confirm("このブラウザの途中データを削除して、最初からやり直しますか？")) return;
    session = null;
    persist();
    $("startForm").reset();
    renderIntro();
  });
  $("playBtn").addEventListener("click", playCurrent);
  $("player").addEventListener("ended", () => {
    if (!session || !currentAudio) return;
    session.completions[currentAudio.id] =
      Math.min(MAX_PLAYS, (session.completions[currentAudio.id] || 0) + 1);
    audioBusy = false;
    persist();
    updatePlayUI();
  });
  $("player").addEventListener("error", () => {
    if (!audioBusy || !session || !currentAudio) return;
    // A broken audio download should not consume a playback allowance.
    session.attempts[currentAudio.id] = Math.max(0, attempts() - 1);
    audioBusy = false;
    persist();
    updatePlayUI();
    $("trialError").textContent = "音声の読み込みに失敗しました。通信状態をご確認のうえ再試行してください。";
    $("trialError").hidden = false;
  });
  $("ratingForm").addEventListener("submit", recordRating);
  $("submitBtn").addEventListener("click", submitResponses);
  $("csvBtn").addEventListener("click", downloadCSV);
  $("clearBtn").addEventListener("click", () => {
    if (!confirm("この端末に保存された回答を削除しますか？")) return;
    session = null;
    persist();
    location.reload();
  });
}

initialize();
