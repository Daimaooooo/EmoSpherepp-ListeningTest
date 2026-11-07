/**
 * EmoSphere++ pilot listening study: Google Apps Script receiver.
 *
 * Deploy as a NEW Web App. Do not point at the previous graduation experiment.
 * Set Script Property SPREADSHEET_ID to the ID of a NEW spreadsheet.
 * Execute as: Me. Access: Anyone (anonymous participants).
 *
 * This receiver stores one complete response per spreadsheet row, making
 * submission_id de-duplication atomic at the row level.
 */

const STUDY_ID = "emospherepp-r-intensity-pilot-v1";
const TAB_NAME = "Submissions";
const IDS = ["Q7M2A", "N4K9P", "X2V8R", "T6H3W", "L8D5C", "B3F7J", "M9R4S", "H5Z2N", "P2Y6T"];
const HEADER = [
  "submission_id", "participant_id", "study_id", "received_at",
  "started_at", "completed_at", "device", "tts_experience",
  "presentation_order_json", "responses_json"
];

function doGet() {
  return HtmlService.createHtmlOutput(
    "<p>EmoSphere++ survey receiver is available. Use POST to submit responses.</p>"
  );
}

function reply_(submissionId, ok) {
  const message = JSON.stringify({
    type: "EMOSPHERE_GAS_ACK",
    submissionId: submissionId || "",
    ok: Boolean(ok)
  }).replace(/</g, "\\u003c");
  const html = "<!doctype html><html><head><meta charset='utf-8'></head><body>" +
    "<script>window.parent.postMessage(" + message + ", '*');</script>" +
    "<p>Response processed.</p></body></html>";
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function integerBetween_(number, min, max) {
  return typeof number === "number" && Number.isInteger(number) &&
    number >= min && number <= max;
}

function assertPayload_(p) {
  if (!p || p.studyId !== STUDY_ID) throw new Error("Invalid study");
  if (!/^S-[0-9a-f-]{36}$/.test(p.submissionId || "")) throw new Error("Invalid submission ID");
  if (!/^P-[0-9a-f-]{36}$/.test(p.participantId || "")) throw new Error("Invalid participant ID");
  if (!p.setup || !["headphones", "speakers", "other"].includes(p.setup.device)) {
    throw new Error("Invalid device");
  }
  if (!["often", "sometimes", "rarely"].includes(p.setup.ttsExperience)) {
    throw new Error("Invalid familiarity");
  }
  if (!Array.isArray(p.order) || p.order.length !== 9 ||
    new Set(p.order).size !== 9 || !IDS.every((id) => p.order.includes(id))) {
    throw new Error("Invalid order");
  }
  if (!Array.isArray(p.responses) || p.responses.length !== 9) {
    throw new Error("Invalid response count");
  }
  const seen = new Set();
  p.responses.forEach(function (r, i) {
    if (r.stimulusId !== p.order[i] || seen.has(r.stimulusId) ||
      !integerBetween_(r.trialIndex, 1, 9) || r.trialIndex !== i + 1 ||
      !integerBetween_(r.joy, 1, 7) || !integerBetween_(r.naturalness, 1, 5) ||
      !integerBetween_(r.playCount, 1, 2) ||
      !integerBetween_(r.playAttempts, r.playCount, 2) ||
      typeof r.rtMs !== "number" || !Number.isFinite(r.rtMs) ||
      r.rtMs < 0 || r.rtMs > 3600000) {
      throw new Error("Invalid response at index " + i);
    }
    seen.add(r.stimulusId);
  });
  if (JSON.stringify(p).length > 30000) throw new Error("Payload too large");
  return p;
}

function sheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id) throw new Error("SPREADSHEET_ID not configured");
  const book = SpreadsheetApp.openById(id);
  let sheet = book.getSheetByName(TAB_NAME);
  if (!sheet) {
    sheet = book.insertSheet(TAB_NAME);
    sheet.appendRow(HEADER);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doPost(e) {
  let submissionId = "";
  let lock;
  try {
    const payloadText = e && e.parameter && e.parameter.payload;
    if (typeof payloadText !== "string") throw new Error("Missing payload");
    const p = assertPayload_(JSON.parse(payloadText));
    submissionId = p.submissionId;
    lock = LockService.getScriptLock();
    lock.waitLock(15000);
    const sheet = sheet_();
    const last = sheet.getLastRow();
    const existing = last > 1
      ? sheet.getRange(2, 1, last - 1, 1).createTextFinder(submissionId)
        .matchEntireCell(true).findNext()
      : null;
    if (!existing) {
      sheet.appendRow([
        submissionId,
        p.participantId,
        STUDY_ID,
        new Date().toISOString(),
        p.startedAt,
        p.completedAt,
        p.setup.device,
        p.setup.ttsExperience,
        JSON.stringify(p.order),
        JSON.stringify(p.responses)
      ]);
      SpreadsheetApp.flush();
    }
    return reply_(submissionId, true);
  } catch (error) {
    console.error("Submission failed:", String(error));
    return reply_(submissionId, false);
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}
