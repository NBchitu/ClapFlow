#!/usr/bin/env python3
import json
import math
import re
import sys
from pathlib import Path

REQ_TOP = ["meta", "input", "selected_configuration", "global_rules", "shots", "validation"]
REQ_SHOT = ["shot_id", "scene_id", "time", "content", "prompts", "dialogue", "assets", "continuity"]
REQ_TIME = ["start_sec", "end_sec", "duration_sec", "range"]
REQ_CONTENT = ["shot_size", "camera_movement", "frame_description", "lighting_mood"]
REQ_PROMPTS = ["text_to_image", "image_to_video"]
REQ_FIELDS = ["主体：", "空间：", "光影：", "镜头：", "音效："]
NEG_RE = re.compile(r"不要|不能|禁止|没有")
K_RE = re.compile(r"\d{3,5}\s*K", re.I)
RATIO_RE = re.compile(r"\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?")
TAG_RE = re.compile(r"@(?:人物|图片|道具)\d+")
CONTINUITY_RE = re.compile(r"延续|衔接|过渡|出画|入画|速度|加速|减速|匀速")


def err(msg):
    print(f"[FAIL] {msg}")
    return False


def ok(msg):
    print(f"[OK] {msg}")


def warn(msg):
    print(f"[WARN] {msg}")


def has_keys(obj, keys, ctx):
    missing = [k for k in keys if k not in obj]
    if missing:
        return err(f"{ctx} missing keys: {missing}")
    return True


def quality_warnings(shot, idx):
    ws = []
    p = str(shot.get("prompts", {}).get("text_to_image", "") or "")
    pv = str(shot.get("prompts", {}).get("image_to_video", "") or "")

    if len(p.strip()) < 80:
        ws.append(f"shots[{idx}].prompts.text_to_image too short (<80 chars), 可能画面感不足")

    for f in REQ_FIELDS:
        if f not in p:
            ws.append(f"shots[{idx}].prompts.text_to_image missing field: {f}")

    if "空间：" in p and not all(x in p for x in ["前景-", "中景-", "背景-"]):
        ws.append(f"shots[{idx}] 空间字段缺少前景/中景/背景三层")

    if "主体：" in p and "正在" not in p:
        ws.append(f"shots[{idx}] 主体字段缺少'正在'+动作表达")

    if not K_RE.search(p):
        ws.append(f"shots[{idx}] 光影字段缺少色温K值")

    if not RATIO_RE.search(p):
        ws.append(f"shots[{idx}] 光影字段缺少明暗比(X:1)")

    if NEG_RE.search(p):
        ws.append(f"shots[{idx}] 含否定句(不要/不能/禁止/没有)，建议改肯定表达")

    dialogue = shot.get("dialogue") or []
    if dialogue:
        if "台词：" not in p:
            ws.append(f"shots[{idx}] dialogue存在但text_to_image缺少'台词：'字段")
        for d in dialogue:
            t = str(d.get("text", ""))
            if t and t not in p:
                ws.append(f"shots[{idx}] 台词未逐字保留: {t}")

    tags = shot.get("assets", {}).get("tags") or []
    if tags:
        used = set(TAG_RE.findall(p))
        missing = [t for t in tags if t not in used]
        if missing:
            ws.append(f"shots[{idx}] text_to_image 未包含资产标签: {missing}")

    if len(pv.strip()) < 60:
        ws.append(f"shots[{idx}].prompts.image_to_video too short (<60 chars)")
    if not CONTINUITY_RE.search(pv):
        ws.append(f"shots[{idx}].prompts.image_to_video 缺少连续性语义(衔接/速度/出入画等)")

    return ws


def main():
    strict = "--strict" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--strict"]
    if len(args) < 1:
        print("Usage: validate_output_json.py <storyboard.json> [--strict]")
        raise SystemExit(1)

    p = Path(args[0])
    data = json.loads(p.read_text(encoding='utf-8'))

    if not isinstance(data, dict):
        raise SystemExit(err("root is not JSON object"))
    if not has_keys(data, REQ_TOP, "root"):
        raise SystemExit(2)

    shots = data.get("shots")
    if not isinstance(shots, list) or not shots:
        raise SystemExit(err("shots must be non-empty array"))

    all_warns = []
    for i, s in enumerate(shots, 1):
        if not isinstance(s, dict):
            raise SystemExit(err(f"shots[{i-1}] not object"))
        if not has_keys(s, REQ_SHOT, f"shots[{i-1}]"):
            raise SystemExit(2)
        if not has_keys(s["time"], REQ_TIME, f"shots[{i-1}].time"):
            raise SystemExit(2)
        if not has_keys(s["content"], REQ_CONTENT, f"shots[{i-1}].content"):
            raise SystemExit(2)
        if not has_keys(s["prompts"], REQ_PROMPTS, f"shots[{i-1}].prompts"):
            raise SystemExit(2)
        all_warns.extend(quality_warnings(s, i-1))

    ids = [s["shot_id"] for s in shots]
    if ids != list(range(1, len(ids)+1)):
        raise SystemExit(err("shot_id must be sequential starting from 1"))

    sum_dur = sum(float(s["time"]["duration_sec"]) for s in shots)
    target = float(data["input"].get("duration_sec", sum_dur))
    if not math.isclose(sum_dur, target, rel_tol=0, abs_tol=0.01):
        warn(f"duration mismatch sum={sum_dur} target={target}")
    else:
        ok(f"duration matched: {sum_dur}")

    if all_warns:
        for w in all_warns:
            warn(w)
        warn(f"quality warnings total: {len(all_warns)}")
        if strict:
            raise SystemExit(err("strict mode failed due to quality warnings"))

    ok(f"validated shots: {len(shots)}")
    print("[PASS] JSON contract validation complete")


if __name__ == "__main__":
    main()
