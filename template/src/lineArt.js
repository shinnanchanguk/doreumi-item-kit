// The SECOND file to edit (after src/item.js): the line drawing of the same item for the DoRms linktree.
// On every teacher's linktree page, a black-and-white line Doreumi stands on top of the lockers and wears what the
// teacher chose in Doreumi's wardrobe. A 3D item cannot be shown there, so each item also ships this line art.
// Read the "링크트리 선 그림" section of AGENTS.md before changing it. `npm run preview` → "선 그림" shows it.
//
// buildLineArt(draw) returns draw.art({ layer: [paths...] }, ant?). Coordinates are the line Doreumi's own
// (x right, y down; head top (143,61), face center (133,136), Doreumi's left arm is on the RIGHT of the screen).
//
// This example is the blue top hat from src/item.js: a tall crown with a band and a wide brim on top of the head.
// The 3D hat covers Doreumi's head curl, so the curl is hidden (ant "hide") and the hat is on the "over" layer.
export function buildLineArt({ art, ellipse, smooth, fl, l, s }) {
  const brimY = 66;           // where the brim sits (a little below the head top, like the 3D hat)
  const crownTop = 4;         // the crown is about as tall as the 3D one (0.48 of Doreumi's 2.14 height)
  const crown = smooth([[104, brimY - 4], [101, crownTop + 6], [143, crownTop - 4], [185, crownTop + 6], [182, brimY - 4]], false, 0.6);
  return art({
    over: [
      // Brim: a wide flat ellipse, slightly tilted with Doreumi's 3/4 turn.
      fl(ellipse(143, brimY, 64, 12, -3)),
      // Crown: closed shape from the brim up to a soft oval top.
      fl(`${crown}Q143 ${brimY + 4} 104 ${brimY - 4}Z`),
      s(ellipse(143, crownTop + 3, 40, 8, -3)),
      // Band near the bottom of the crown (yellow in 3D: two lines here).
      l(smooth([[103, brimY - 18], [143, brimY - 12], [183, brimY - 18]], false)),
      l(smooth([[103, brimY - 9], [143, brimY - 3], [183, brimY - 9]], false)),
    ],
  }, "hide");
}
