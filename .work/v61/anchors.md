# P0 measured anchor inventory

HEAD: 3066550c035bc7281443cc2689ecd69ae7c8d04b

## Baseline bytes

```
485175 index.html
 269514 data/learning-tools.js
 106144 data/studio.js
  21246 data/data-meter.js
  59845 data.html
  59845 data/index.html
   7100 sw.js
1008869 total
```

## Matching-line counts (`grep -c`) and occurrence totals

### index.html

- `sdpV57Css`: lines=1, occurrences=1
- `sdpV58Css`: lines=1, occurrences=1
- `sdpLearnCss`: lines=0, occurrences=0
- `sdpV59Css`: lines=0, occurrences=0
- `sdpDataSheetCss`: lines=1, occurrences=1
- `sdpNextGenCss`: lines=0, occurrences=0
- `v604All`: lines=0, occurrences=0
- `creditDocked`: lines=0, occurrences=0
- `setTimeout\(`: lines=4, occurrences=60
- `MutationObserver`: lines=0, occurrences=0
- `Screens.home`: lines=2, occurrences=31
- `Speech.say`: lines=1, occurrences=4
- `wrapTabset\|wrapHome\|wrapPaint\|wrapSettings\|wrapDict\|wrapCockpit`: lines=0, occurrences=0
- `guide-si-`: lines=0, occurrences=0
### data/learning-tools.js

- `sdpV57Css`: lines=3, occurrences=3
- `sdpV58Css`: lines=3, occurrences=3
- `sdpLearnCss`: lines=1, occurrences=1
- `sdpV59Css`: lines=2, occurrences=2
- `sdpDataSheetCss`: lines=0, occurrences=0
- `sdpNextGenCss`: lines=6, occurrences=6
- `v604All`: lines=7, occurrences=7
- `creditDocked`: lines=10, occurrences=10
- `setTimeout\(`: lines=4, occurrences=38
- `MutationObserver`: lines=4, occurrences=4
- `Screens.home`: lines=0, occurrences=0
- `Speech.say`: lines=1, occurrences=1
- `wrapTabset\|wrapHome\|wrapPaint\|wrapSettings\|wrapDict\|wrapCockpit`: lines=12, occurrences=18
- `guide-si-`: lines=0, occurrences=0

## Baseline comparison without switching branches

### ef6cdfa
- index.html: ef6cdfa:index.html
- data/learning-tools.js: ef6cdfa:data/learning-tools.js
- data/studio.js: ef6cdfa:data/studio.js
- data/data-meter.js: ef6cdfa:data/data-meter.js
- data.html: ef6cdfa:data.html
- data/index.html: ef6cdfa:data/index.html
- sw.js: ef6cdfa:sw.js
### 3066550
- index.html: 0927f546d49d6021b7cca36ad747c289dbad2a40
- data/learning-tools.js: ec171d6141291846a19fdbec083b05c8a95bc157
- data/studio.js: caec1036427af5300b74094c22c21249e8c8509c
- data/data-meter.js: 09865c1d9b6454cd867f219e57ab9ad9c82cdffb
- data.html: 199e3b9eaa2b33050d94b6fb09754c386ac24b1a
- data/index.html: 199e3b9eaa2b33050d94b6fb09754c386ac24b1a
- sw.js: 1fbb0c78955262e2957085730d612bd5437f5ff5

`ef6cdfa` is not present in this shallow checkout; no unavailable anchor was guessed. All surgery uses measured 3066550 anchors.
