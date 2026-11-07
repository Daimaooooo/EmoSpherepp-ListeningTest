#!/usr/bin/env python3
"""Expand Google Sheets Submissions CSV (one participant per row) to trial rows."""
import argparse
import csv
import json
from pathlib import Path

FIELDS = [
    "study_id", "participant_id", "submission_id", "received_at",
    "started_at", "completed_at", "device", "tts_experience",
    "trial_index", "stimulus_id", "rating_joy", "rating_naturalness",
    "play_count", "play_attempts", "rt_ms"
]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Submissions sheet exported as CSV")
    parser.add_argument("output", type=Path, help="Long-form 9 trials per participant")
    parser.add_argument("--key", type=Path, help="Private ID to r mapping, NOT FOR PUBLIC GITHUB")
    args = parser.parse_args()

    key = {}
    if args.key:
        with args.key.open(newline="", encoding="utf-8-sig") as handle:
            for row in csv.DictReader(handle):
                if row["stimulus_id"] in key:
                    raise ValueError("Duplicate ID in key")
                key[row["stimulus_id"]] = row["radius_r"]

    seen, result = set(), []
    with args.input.open(newline="", encoding="utf-8-sig") as handle:
        for line, source in enumerate(csv.DictReader(handle), 2):
            submission_id = source["submission_id"]
            if submission_id in seen:
                raise ValueError(f"Duplicate submission ID at line {line}")
            seen.add(submission_id)
            responses = json.loads(source["responses_json"])
            order = json.loads(source["presentation_order_json"])
            if len(responses) != 9 or len(order) != 9:
                raise ValueError(f"Expected 9 trials at line {line}")
            for i, trial in enumerate(responses):
                if trial["stimulusId"] != order[i] or trial["trialIndex"] != i + 1:
                    raise ValueError(f"Response order mismatch at line {line}, trial {i+1}")
                row = {
                    "study_id": source["study_id"],
                    "participant_id": source["participant_id"],
                    "submission_id": submission_id,
                    "received_at": source["received_at"],
                    "started_at": source["started_at"],
                    "completed_at": source["completed_at"],
                    "device": source["device"],
                    "tts_experience": source["tts_experience"],
                    "trial_index": trial["trialIndex"],
                    "stimulus_id": trial["stimulusId"],
                    "rating_joy": trial["joy"],
                    "rating_naturalness": trial["naturalness"],
                    "play_count": trial["playCount"],
                    "play_attempts": trial["playAttempts"],
                    "rt_ms": trial["rtMs"],
                }
                if args.key:
                    if trial["stimulusId"] not in key:
                        raise ValueError(f"Missing key for stimulus {trial['stimulusId']}")
                    row["radius_r"] = key[trial["stimulusId"]]
                result.append(row)

    fields = FIELDS + (["radius_r"] if args.key else [])
    with args.output.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(result)
    print(f"Exported {len(result)} trials from {len(seen)} participants: {args.output}")

if __name__ == "__main__":
    main()
