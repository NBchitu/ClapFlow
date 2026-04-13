# Merge Strategy: Yuanlong × Video Creation

## Objective
Use Yuanlong as the **creative engine** and Video Creation as the **project adapter**.

## Operating Model
1. Parse script with director-level analysis.
2. Generate scene/shot plan with pacing and continuity constraints.
3. Generate cinematic prompts per shot.
4. Write ClapFlow project files directly (one-pass, no converter dependency).

## Why this split works
- Yuanlong contributes: director library, style controls, narrative rhythm discipline.
- Video Creation contributes: folder/file schema, shot statuses, asset JSON integration.

## Execution Priority
1. Narrative continuity
2. Cinematic pacing
3. Prompt professionalism
4. Project schema compliance

## Non-Goal (Runtime)
- Do not rely on conversion scripts in the normal generation path.

## Legacy References
- `../../yuanlong-storyboard-suite/references/yuanlong-configurations.md`
- `../../video-creation-suite/SKILL.md`
