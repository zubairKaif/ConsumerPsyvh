/* Eye tracking. Milestone 5 adds the mouse and webcam sources; this is the no-tracking stub. */
'use strict';

const Tracker = {
  create(cfg) {
    return {
      setup: async () => {}, midCheck: async () => {},
      beginTrial() {}, screen() {}, refresh() {}, endScreens() {},
      billSummary: () => ({}), calAccDeg: () => '', hasGaze: () => false, gazeCSV: () => toCSV(GAZE_COLUMNS, []),
    };
  },
};
