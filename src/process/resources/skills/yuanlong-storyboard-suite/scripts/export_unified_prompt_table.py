#!/usr/bin/env python3
import csv,re,sys
from pathlib import Path

row_re=re.compile(r"^\|(.+)\|$")

def parse(md):
    rows=[]
    for ln in md.splitlines():
        m=row_re.match(ln.strip())
        if not m: continue
        cols=[c.strip() for c in m.group(1).split('|')]
        if not cols: continue
        if all(set(c)<=set('-: ') for c in cols):
            continue
        rows.append(cols)
    return rows

if len(sys.argv)<3:
    print('Usage: export_unified_prompt_table.py <in.md> <out.csv>')
    raise SystemExit(1)

rows=parse(Path(sys.argv[1]).read_text(encoding='utf-8'))
if len(rows)<2:
    print('No table rows found')
    raise SystemExit(2)

h=rows[0]
b=rows[1:]

def find_idx(keys,default):
    for i,v in enumerate(h):
        if any(k in v for k in keys):
            return i
    return default

i_time=find_idx(['时间'],0)
i_prompt=find_idx(['SEEDANCE','提示词'],len(h)-1)

with Path(sys.argv[2]).open('w',newline='',encoding='utf-8') as f:
    w=csv.writer(f)
    w.writerow(['shot_id','time_range','text_to_image_prompt','image_to_video_prompt','tags_used','continuity_notes'])
    for n,r in enumerate(b,1):
        time=r[i_time] if i_time<len(r) else ''
        p=r[i_prompt] if i_prompt<len(r) else ''
        tags=','.join(sorted(set(re.findall(r'@(?:人物|图片|道具)\d+',p))))
        w.writerow([n,time,p,p,tags,''])
print('done')
