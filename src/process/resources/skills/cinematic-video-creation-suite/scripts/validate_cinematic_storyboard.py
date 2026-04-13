#!/usr/bin/env python3
"""Validate cinematic storyboard JSON used by cinematic-video-creation-suite."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

SHOT_TYPES = {"EWS", "WS", "MS", "CU", "ECU"}
CAMERA_MOVES = {"static", "push", "pull", "pan", "tilt", "handheld"}

SCENE_RE = re.compile(r"^scene-\d{2}$")


def fail(msg: str) -> bool:
    print(f"[FAIL] {msg}")
    return False


def warn(msg: str) -> None:
    print(f"[WARN] {msg}")


def ok(msg: str) -> None:
    print(f"[OK] {msg}")


def require_keys(data: dict[str, Any], keys: list[str], ctx: str) -> bool:
    missing = [k for k in keys if k not in data]
    if missing:
        return fail(f"{ctx} missing keys: {missing}")
    return True


def check_shot(shot: dict[str, Any], scene_id: str, idx: int, strict: bool) -> bool:
    req = ["sceneId", "goal", "sceneDescription", "action", "dialogue", "shotType", "cameraMove", "duration"]
    if not require_keys(shot, req, f"shots[{idx}]"):
        return False

    if shot["sceneId"] != scene_id:
        return fail(f"shots[{idx}].sceneId ({shot['sceneId']}) != scene id ({scene_id})")

    shot_type = shot["shotType"]
    if shot_type not in SHOT_TYPES:
        return fail(f"shots[{idx}].shotType invalid: {shot_type}")

    camera_move = shot["cameraMove"]
    if camera_move not in CAMERA_MOVES:
        return fail(f"shots[{idx}].cameraMove invalid: {camera_move}")

    duration = shot["duration"]
    if not isinstance(duration, int) or duration < 1 or duration > 30:
        return fail(f"shots[{idx}].duration must be integer 1..30")

    for key in ["goal", "sceneDescription", "action"]:
        if not str(shot.get(key, "")).strip():
            return fail(f"shots[{idx}].{key} cannot be empty")

    cinematic_fields = ["rhythmPurpose", "continuityCue", "cinematicNotes"]
    has_cinematic_hint = any(str(shot.get(k, "")).strip() for k in cinematic_fields)
    if not has_cinematic_hint:
        msg = f"shots[{idx}] has no cinematic metadata in {cinematic_fields}"
        if strict:
            return fail(msg)
        warn(msg)

    return True


def main() -> int:
    strict = "--strict" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--strict"]
    if not args:
        print("Usage: validate_cinematic_storyboard.py <storyboard.json> [--strict]")
        return 1

    file_path = Path(args[0])
    if not file_path.exists():
        return 1 if fail(f"file not found: {file_path}") else 1

    data = json.loads(file_path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        return 2 if fail("root must be object") else 2

    if not require_keys(data, ["style", "scenes"], "root"):
        return 2

    scenes = data.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        return 2 if fail("root.scenes must be non-empty array") else 2

    total_shots = 0
    for i, scene in enumerate(scenes):
        if not isinstance(scene, dict):
            return 2 if fail(f"scenes[{i}] must be object") else 2
        if not require_keys(scene, ["id", "name", "description", "shots"], f"scenes[{i}]"):
            return 2
        scene_id = scene["id"]
        if not isinstance(scene_id, str) or not SCENE_RE.match(scene_id):
            return 2 if fail(f"scenes[{i}].id invalid: {scene_id}") else 2
        shots = scene.get("shots")
        if not isinstance(shots, list) or not shots:
            return 2 if fail(f"scenes[{i}].shots must be non-empty array") else 2

        for j, shot in enumerate(shots):
            if not isinstance(shot, dict):
                return 2 if fail(f"scenes[{i}].shots[{j}] must be object") else 2
            if not check_shot(shot, scene_id, total_shots, strict):
                return 2
            total_shots += 1

    ok(f"validated scenes: {len(scenes)}")
    ok(f"validated shots: {total_shots}")
    print("[PASS] cinematic storyboard validation complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
