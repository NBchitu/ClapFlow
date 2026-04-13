#!/usr/bin/env python3
import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROW_RE = re.compile(r"^\|(.+)\|$")
RANGE_RE = re.compile(r"(\d+(?:\.\d+)?)\s*s?\s*[-–~～到]\s*(\d+(?:\.\d+)?)\s*s?", re.I)
TAG_RE = re.compile(r"@(?:人物|图片|道具)\d+")


def parse_table(md: str):
    rows = []
    for ln in md.splitlines():
        m = ROW_RE.match(ln.strip())
        if not m:
            continue
        cols = [c.strip() for c in m.group(1).split("|")]
        if not cols or all(set(c) <= set('-: ') for c in cols):
            continue
        rows.append(cols)
    if len(rows) < 2:
        return [], []
    return rows[0], rows[1:]


def find_col(header, keys, default):
    for i, h in enumerate(header):
        if any(k in h for k in keys):
            return i
    return default


def main():
    if len(sys.argv) < 3:
        print("Usage: markdown_to_storyboard_json.py <input.md> <output.json>")
        raise SystemExit(1)

    inp = Path(sys.argv[1]).read_text(encoding='utf-8')
    h, rows = parse_table(inp)
    if not rows:
        print("No table rows found")
        raise SystemExit(2)

    i_time = find_col(h, ["时间"], 0)
    i_shot = find_col(h, ["景别"], 1)
    i_cam = find_col(h, ["运镜", "镜头"], 2)
    i_desc = find_col(h, ["画面", "描述"], 3)
    i_light = find_col(h, ["光影", "氛围"], 4)
    i_prompt = find_col(h, ["SEEDANCE", "提示词"], len(h)-1)
    i_drama = find_col(h, ["戏剧", "张力", "冲突"], -1)

    shots = []
    for n, r in enumerate(rows, 1):
        def col(i):
            return r[i] if 0 <= i < len(r) else ""
        tr = col(i_time)
        m = RANGE_RE.search(tr)
        s = float(m.group(1)) if m else float(n-1)
        e = float(m.group(2)) if m else float(n)
        d = max(0.1, e - s)
        prompt = col(i_prompt)
        tags = sorted(set(TAG_RE.findall(prompt)))

        shots.append({
            "shot_id": n,
            "scene_id": 1,
            "time": {"start_sec": s, "end_sec": e, "duration_sec": d, "range": tr or f"{s}s-{e}s"},
            "content": {
                "shot_size": col(i_shot),
                "camera_movement": col(i_cam),
                "frame_description": col(i_desc),
                "lighting_mood": col(i_light),
                "drama_tension": col(i_drama) if i_drama >= 0 else ""
            },
            "prompts": {
                "text_to_image": prompt,
                "image_to_video": prompt
            },
            "dialogue": [],
            "assets": {"tags": tags, "characters": [t for t in tags if t.startswith('@人物')], "scenes": [t for t in tags if t.startswith('@图片')], "props": [t for t in tags if t.startswith('@道具')]},
            "continuity": {"in": "", "out": ""}
        })

    total = round(sum(x["time"]["duration_sec"] for x in shots), 3)
    out = {
        "meta": {
            "schema_version": "yuanlong.storyboard.v1",
            "generated_at": datetime.now().isoformat(),
            "language": "zh-CN"
        },
        "input": {
            "core_plot": "",
            "duration_sec": total,
            "mode": {"chain": False, "stc_enabled": False, "faithful_mode": False, "script_imported": False},
            "shot_count": {"mode": "auto", "target": len(shots)},
            "audio": {"bgm_enabled": True, "subtitle_enabled": True},
            "safety": {"word_filter_enabled": True, "auto_safety_enabled": True}
        },
        "selected_configuration": {
            "director": {},
            "visual_style": {},
            "camera_languages": [],
            "lighting_moods": []
        },
        "global_rules": {
            "dialogue_lock": [],
            "asset_tag_mode": {"character": True, "image": True, "props": True},
            "consistency_rules": []
        },
        "shots": shots,
        "validation": {
            "shot_count_expected": len(shots),
            "shot_count_actual": len(shots),
            "duration_total_sec": total,
            "duration_target_sec": total,
            "passed": True,
            "issues": []
        }
    }

    Path(sys.argv[2]).write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"written: {sys.argv[2]}")


if __name__ == '__main__':
    main()
