# Block 1: body generator shortlist and licences

Date: 2026-11-14. Status: desk research only. Nothing has been installed or run yet.

## Block 0 result (Pixel 8, Opera)

WebGL2 true, GPU Mali-G715, 60 fps, 86 KB model. Pass. Honor 200 Pro not yet tested.

## Candidates

| Candidate | Code licence | Asset / output licence | Measurement-driven? | Verdict |
| --- | --- | --- | --- | --- |
| MPFB2 (MakeHuman plugin for Blender) | GPL v3 or later | Core assets CC0 per the MakeHuman licence page; output not explicitly addressed on that page | Not confirmed: the repo page does not mention it, needs checking in the add-on itself | Primary candidate |
| MB-Lab | Code GPL v3; data AGPL v3 | AGPL data, output terms not confirmed | Yes: has a measurements panel and JSON import/export, and changing height rescales other measures | Backup candidate; AGPL data is a bigger licence question |
| SMPL / SMPL-X | Non-commercial research licence | Non-commercial; commercial licence via Meshcapade | Parametric but not tape-measure driven | Reject: licence |
| STAR, SUPR, MHR, Anny | Not verified | Not verified | Not verified | Not assessed; revisit only if MPFB2 and MB-Lab both fail |

## Facts verified

- MPFB2 latest version 2.0.18 (10 Oct 2026); listing says Blender 4.2 LTS and newer. Blender 5.x is implied, not explicitly confirmed. We run Blender 5.3.0.
- MakeHuman licence page: MPFB code GPL, MakeHuman code AGPL, core assets CC0.
- MPFB2 runs inside Blender, so glTF export uses Blender's own exporter (already proven in Block 0).

## Not verified (must check before relying on it)

1. Does MPFB2 install and run headlessly on Blender 5.3?
2. Does MPFB2 have a usable Python route to set modifiers (macro and per-measurement targets) without the GUI?
3. Can we measure circumferences on the resulting mesh at set landmarks (our own script) and solve for modifier values?
4. Exact licence status of exported meshes (MPFB FAQ answers "Can I sell models made with MPFB?" but I could not read it).
5. Personal use only is intended, so licence is low risk, but record it for any later publishing.

## Recommendation

Go with MPFB2 for Block 2. It has the clearest permissive asset licence. Plan to write our own measurement-solver script, since automatic measurement matching is unconfirmed. Keep MB-Lab as the fallback if MPFB2 fails to run on Blender 5.3 or has no scripting route.

## Needs approval

Download the MPFB2 add-on from extensions.blender.org (about tens of MB with assets; exact size to confirm) into a separate folder outside the repo, then install it into Blender.

## Update: MPFB2 probe (2026-11-14)

- Installed MPFB 2.0.18 (46 MB, SHA-256 matched the extensions.blender.org listing) into Blender 5.3.0 from `C:\Users\joe90\Documents\hue-drobe-downloads\mpfb\` (outside the repo).
- Loads and runs headlessly on Blender 5.3.0: `spike/blender/mpfb_probe.py` creates a default human (19,158 vertices, height 1.659 m, arm span 1.051 m) with no GUI.
- Python route exists: `HumanService.create_human(macro_detail_dict=...)` and `TargetService.set_target_value(...)`.
- Targets include `measure-*` morphs (bust, underbust, waist, hips circumference; shoulder distance; nape-to-waist; waist-to-hip), which suit our measurement mapping.
- Still to do: our own landmark measurement script, since no mesh vertex groups matched waist/hip/bust.
- Licence of exported meshes remains unconfirmed (personal use only, low risk).
