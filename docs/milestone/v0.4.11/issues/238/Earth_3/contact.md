# Companion original contact evidence

Source comparison viewed: `demo/assets/leaders/companion/battle256.png`, `demo/assets/leaders/king/battle256.png`, and CJ Image 4 from the revision brief. The native tool outputs were visually inspected at master size. These embedded thumbnails are review aids, not exported game assets or a claim of completed runtime QA.

| Size | Attack: sword / wide stance | Defense: shield / compact mass |
|---|---|---|
| 128 | <img src="companion_atk/master.png" width="128" height="128" alt="Attack knight, diagonal broadsword" /> | <img src="companion_def/master.png" width="128" height="128" alt="Defense guardian, tower shield" /> |
| 64 | <img src="companion_atk/master.png" width="64" height="64" alt="Attack knight" /> | <img src="companion_def/master.png" width="64" height="64" alt="Defense guardian" /> |
| 32 | <img src="companion_atk/master.png" width="32" height="32" alt="Attack knight" /> | <img src="companion_def/master.png" width="32" height="32" alt="Defense guardian" /> |

Both full bodies and equipment are visible, with no scenery, lettering or UI. At alpha >15, transparent margins left/top/right/bottom are attack **143/77/60/61 px**, defense **136/113/124/125 px**. Alpha-1 edge noise means raw alpha bounds are unsuitable for tight crops. Actual derivative filtering and small-size readability acceptance remain with Mars/QA; preserve these master bytes.
