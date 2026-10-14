# Road shadow depth regression

Open `check.html?perf=mid&mute=1` through the local server. It extracts the real detailed-road material from a generated chunk and renders a shadow receiver above the unlit far-road underlay. Each render is compared with the same scene with the underlay hidden.

`result.json` records 767 differing pixels with the old `depthWrite: false` and zero with production `depthWrite: true`. `comparison.png` shows the fixed and former behavior. Low-tier shadow policy is unchanged; this fixes shadows when shadows are enabled.
