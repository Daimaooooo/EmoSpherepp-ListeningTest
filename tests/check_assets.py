#!/usr/bin/env python3
"""Check public stimuli and the browser manifest without third-party packages."""
import json
import pathlib
import wave

BASE = pathlib.Path(__file__).resolve().parent.parent / "docs"

def main():
    manifest = json.loads((BASE / "conditions.json").read_text(encoding="utf-8"))
    assert len(manifest) == 9, "Expected nine stimuli"
    ids, names = set(), set()
    for item in manifest:
        assert item["id"] not in ids, "Repeated stimulus ID"
        assert item["audio"] not in names, "Repeated audio"
        assert item["audio"].startswith("audio/"), "Path outside audio directory"
        assert "r_" not in item["audio"], "Radius exposed in public file name"
        ids.add(item["id"])
        names.add(item["audio"])
        wav = BASE / item["audio"]
        assert wav.is_file(), f"Missing {wav}"
        with wave.open(str(wav), "rb") as f:
            channels, rate, width, frames = (
                f.getnchannels(), f.getframerate(), f.getsampwidth(), f.getnframes()
            )
        assert (channels, rate, width) == (1, 16000, 2), f"Unexpected WAV format: {wav}"
        assert 16000 < frames < 160000, f"Unexpected duration: {wav}"
        print(f"{item['id']}: OK ({frames/rate:.3f}s, mono, PCM16, {rate} Hz)")
    actual = {p.name for p in (BASE / "audio").glob("*.wav")}
    assert actual == {pathlib.Path(x).name for x in names}, "Extra or missing WAVs"
    print("PASS: 9 unique WAV stimuli are ready.")

if __name__ == "__main__":
    main()
