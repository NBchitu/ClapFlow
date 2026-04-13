#!/usr/bin/env python3
"""Convert Yuanlong storyboard contract JSON to ClapFlow project files.

Usage:
  python3 convert_yuanlong_to_video_project.py <yuanlong_json> <project_root> [--title "Project Title"]
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

SHOT_TYPES = {
    "ews": "EWS",
    "extreme wide": "EWS",
    "大全景": "EWS",
    "远景": "EWS",
    "ws": "WS",
    "wide": "WS",
    "全景": "WS",
    "ms": "MS",
    "medium": "MS",
    "中景": "MS",
    "cu": "CU",
    "close": "CU",
    "近景": "CU",
    "特写": "CU",
    "ecu": "ECU",
    "extreme close": "ECU",
    "大特写": "ECU",
    "微距": "ECU",
}

CAMERA_MOVES = {
    "static": "static",
    "固定": "static",
    "静止": "static",
    "push": "push",
    "推进": "push",
    "push in": "push",
    "pull": "pull",
    "拉远": "pull",
    "pull back": "pull",
    "pan": "pan",
    "摇": "pan",
    "摇镜": "pan",
    "tilt": "tilt",
    "俯仰": "tilt",
    "升降": "tilt",
    "handheld": "handheld",
    "手持": "handheld",
    "跟拍": "handheld",
}


def normalize_asset_name(name: str) -> str:
    return re.sub(r"\s+", "_", name.strip())


def ensure_dirs(project_root: Path) -> dict[str, Path]:
    paths = {
        "script": project_root / "00-script" / "script.md",
        "storyboard": project_root / "01-storyboard" / "storyboard.json",
        "shots": project_root / "01-storyboard" / "shots",
        "characters": project_root / "02-assets" / "characters",
        "scenes": project_root / "02-assets" / "scenes",
        "props": project_root / "02-assets" / "props",
        "images": project_root / "03-images",
        "videos": project_root / "04-videos",
        "memory": project_root / "90-memory",
        "logs": project_root / "99-logs" / "harness-runs",
    }
    for key, path in paths.items():
        if key == "script" or path.suffix:
            path.parent.mkdir(parents=True, exist_ok=True)
        else:
            path.mkdir(parents=True, exist_ok=True)
    return paths


def map_shot_type(value: Any) -> str:
    text = str(value or "").strip().lower()
    for key, mapped in SHOT_TYPES.items():
        if key in text:
            return mapped
    return "MS"


def map_camera_move(value: Any) -> str:
    text = str(value or "").strip().lower()
    for key, mapped in CAMERA_MOVES.items():
        if key in text:
            return mapped
    return "static"


def clamp_duration(value: Any) -> int:
    try:
        val = int(round(float(value)))
    except Exception:
        return 4
    return max(1, min(30, val))


def parse_scene_num(value: Any) -> int:
    if isinstance(value, int):
        return max(1, value)
    text = str(value or "").strip()
    match = re.search(r"\d+", text)
    if match:
        return max(1, int(match.group(0)))
    return 1


def flatten_dialogue(dialogue: Any) -> str:
    if isinstance(dialogue, list):
        parts: list[str] = []
        for item in dialogue:
            if isinstance(item, dict):
                text = str(item.get("text", "")).strip()
                if text:
                    parts.append(text)
        return " ".join(parts)
    if isinstance(dialogue, str):
        return dialogue.strip()
    return ""


def classify_tag(tag: str) -> str:
    if tag.startswith("@人物"):
        return "character"
    if tag.startswith("@图片"):
        return "scene"
    if tag.startswith("@道具"):
        return "prop"
    return "unknown"


def build_asset_registry(shots: list[dict[str, Any]]) -> tuple[dict[str, str], dict[str, str], dict[str, str]]:
    characters: dict[str, str] = {}
    scenes: dict[str, str] = {}
    props: dict[str, str] = {}

    char_i = 1
    scene_i = 1
    prop_i = 1

    for shot in shots:
        assets = shot.get("assets") or {}
        tags = assets.get("tags") or []
        for raw_tag in tags:
            tag = str(raw_tag).strip()
            if not tag:
                continue
            kind = classify_tag(tag)
            if kind == "character" and tag not in characters:
                characters[tag] = f"char-{char_i:03d}"
                char_i += 1
            elif kind == "scene" and tag not in scenes:
                scenes[tag] = f"scene-asset-{scene_i:03d}"
                scene_i += 1
            elif kind == "prop" and tag not in props:
                props[tag] = f"prop-{prop_i:03d}"
                prop_i += 1

    return characters, scenes, props


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("yuanlong_json")
    parser.add_argument("project_root")
    parser.add_argument("--title", default="")
    args = parser.parse_args()

    source_path = Path(args.yuanlong_json)
    project_root = Path(args.project_root).expanduser().resolve()

    data = json.loads(source_path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("yuanlong input must be JSON object")

    shots_raw = data.get("shots")
    if not isinstance(shots_raw, list) or not shots_raw:
        raise ValueError("yuanlong input must include non-empty shots[]")

    paths = ensure_dirs(project_root)

    script_text = str((data.get("input") or {}).get("core_plot") or "")
    if script_text and not paths["script"].exists():
        paths["script"].write_text(script_text + "\n", encoding="utf-8")

    style_source = data.get("selected_configuration") or {}
    director = style_source.get("director") or {}
    visual = style_source.get("visual_style") or {}

    scene_ids_sorted = sorted({parse_scene_num(shot.get("scene_id", 1)) for shot in shots_raw} or {1})
    scene_id_map = {sid: f"scene-{idx:02d}" for idx, sid in enumerate(scene_ids_sorted, start=1)}

    scene_shot_ids: dict[str, list[str]] = {sid: [] for sid in scene_id_map.values()}
    scene_descriptions: dict[str, str] = {sid: "" for sid in scene_id_map.values()}

    char_registry, scene_registry, prop_registry = build_asset_registry(shots_raw)

    shot_files: list[tuple[str, dict[str, Any]]] = []

    for idx, shot in enumerate(shots_raw, start=1):
        source_scene_id = parse_scene_num(shot.get("scene_id", 1))
        scene_id = scene_id_map.get(source_scene_id, "scene-01")
        shot_id = f"shot-{idx:03d}"
        scene_shot_ids.setdefault(scene_id, []).append(shot_id)

        time = shot.get("time") or {}
        content = shot.get("content") or {}
        prompts = shot.get("prompts") or {}
        assets = shot.get("assets") or {}

        scene_desc = str(content.get("frame_description") or "").strip()
        if scene_desc and not scene_descriptions.get(scene_id):
            scene_descriptions[scene_id] = scene_desc

        asset_refs: list[str] = []
        for tag in assets.get("characters") or []:
            ref = char_registry.get(str(tag))
            if ref:
                asset_refs.append(ref)
        for tag in assets.get("scenes") or []:
            ref = scene_registry.get(str(tag))
            if ref:
                asset_refs.append(ref)
        for tag in assets.get("props") or []:
            ref = prop_registry.get(str(tag))
            if ref:
                asset_refs.append(ref)

        duration = clamp_duration(time.get("duration_sec", 4))
        dialogue_text = flatten_dialogue(shot.get("dialogue"))

        shot_payload = {
            "id": shot_id,
            "sceneId": scene_id,
            "sceneIndex": max(0, scene_ids_sorted.index(source_scene_id)) if source_scene_id in scene_ids_sorted else 0,
            "sceneShotIndex": len(scene_shot_ids[scene_id]),
            "shotIndex": idx,
            "goal": str(content.get("drama_tension") or "推进叙事与情绪").strip() or "推进叙事与情绪",
            "sceneDescription": scene_desc,
            "characters": [normalize_asset_name(str(tag).lstrip("@")) for tag in assets.get("characters") or []],
            "action": str(content.get("frame_description") or "").strip(),
            "dialogue": dialogue_text,
            "shotType": map_shot_type(content.get("shot_size")),
            "cameraMove": map_camera_move(content.get("camera_movement")),
            "imagePrompt": str(prompts.get("text_to_image") or "").strip(),
            "videoPrompt": str(prompts.get("image_to_video") or "").strip(),
            "lockedTokens": [],
            "continuityRefs": {
                "prevShotId": f"shot-{idx - 1:03d}" if idx > 1 else None,
                "nextShotId": f"shot-{idx + 1:03d}" if idx < len(shots_raw) else None,
                "sharedCharacters": [],
                "sharedProps": [],
                "sharedScene": scene_id,
            },
            "assetRefs": sorted(set(asset_refs)),
            "duration": duration,
            "status": "prompts-ready" if prompts.get("text_to_image") or prompts.get("image_to_video") else "pending",
            "locked": False,
        }
        shot_files.append((shot_id, shot_payload))

    now_iso = datetime.now().astimezone().isoformat()
    storyboard = {
        "id": datetime.now().strftime("%H%M%S%f")[:8],
        "title": args.title or str(data.get("title") or "cinematic-project"),
        "projectRoot": str(project_root),
        "scriptPath": str(paths["script"]),
        "style": {
            "genre": str(director.get("tag_category") or "cinematic drama"),
            "visualStyle": str(visual.get("name") or visual.get("value") or "cinematic"),
            "colorPalette": str((data.get("global_rules") or {}).get("palette") or "moody cinematic palette"),
            "cameraPreferences": ["MS", "CU", "static"],
            "referenceWorks": [str(director.get("name") or "")],
            "negativeStyle": "",
        },
        "scenes": [
            {
                "id": scene_id,
                "name": f"Scene {i}",
                "description": scene_descriptions.get(scene_id, "") or "",
                "timeOfDay": "",
                "location": "",
                "shotIds": scene_shot_ids.get(scene_id, []),
            }
            for i, scene_id in enumerate(scene_id_map.values(), start=1)
        ],
        "shotIds": [shot_id for shot_id, _ in shot_files],
        "createdAt": now_iso,
        "updatedAt": now_iso,
    }

    write_json(paths["storyboard"], storyboard)

    for shot_id, payload in shot_files:
        write_json(paths["shots"] / f"{shot_id}.json", payload)

    for tag, asset_id in char_registry.items():
        write_json(
            paths["characters"] / f"{asset_id}.json",
            {
                "id": asset_id,
                "name": normalize_asset_name(tag.lstrip("@")),
                "description": f"Imported from {tag}",
                "appearance": "",
                "prompt": "",
                "lockedTokens": [],
                "referenceImagePaths": [],
            },
        )

    for tag, asset_id in scene_registry.items():
        write_json(
            paths["scenes"] / f"{asset_id}.json",
            {
                "id": asset_id,
                "name": normalize_asset_name(tag.lstrip("@")),
                "description": f"Imported from {tag}",
                "prompt": "",
                "referenceImagePaths": [],
            },
        )

    for tag, asset_id in prop_registry.items():
        write_json(
            paths["props"] / f"{asset_id}.json",
            {
                "id": asset_id,
                "name": normalize_asset_name(tag.lstrip("@")),
                "description": f"Imported from {tag}",
                "prompt": "",
                "referenceImagePaths": [],
            },
        )

    print(f"[OK] converted yuanlong contract: {source_path}")
    print(f"[OK] project written to: {project_root}")
    print(f"[OK] shots: {len(shot_files)} | scenes: {len(scene_id_map)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
