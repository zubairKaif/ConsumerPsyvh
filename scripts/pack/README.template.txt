QUIKKART STIMULUS PACK
SOM 749, IIT Bombay. Built {{BUILT}}.

QuikKart is a fictitious Android quick-commerce app used as the stimulus in a
between-subjects experiment on drip pricing. Arm A shows only the item total
before the bill (fees appear late, on the bill). Arm B shows every fee up front
(a fee banner on the product list, an all-in total on the cart). The bill screen
is pixel-identical in both arms; only the screens before it differ.


1. FILES
--------
QuikKart_Stimulus_App.html   The whole app in one file (works offline). Opens
                             the researcher console by default.
Start_QuikKart_Windows.bat   Serves this folder at http://localhost:8000 and
                             opens the app (needs Python 3).
Start_QuikKart_Mac.command   The same for macOS.
webcam/                      WebGazer 3.5.3 and the MediaPipe face-mesh files,
                             used only for webcam eye tracking. Licences inside.
stimuli_png/                 54 screen images for Tobii Pro Lab, 1920 x 1080:
                             {arm}_{trial}_{n}_{screen}.png, n = 1 listing,
                             2 cart, 3 bill; plus fixation.png and blank_mask.png.
aoi_preview/                 The same 54 images with the AOIs drawn on (pink;
                             dashed blue = click zone).
AOI_coordinates.csv          Every AOI of every image, in image pixels.
trial_orders_P001-P080.csv   Arm, list, recall trials and the seeded trial order
                             for participants P001 to P080.
licences/                    Licence of the embedded Roboto font (OFL-1.1).


2. STARTING THE APP
-------------------
Windows: double-click Start_QuikKart_Windows.bat. Keep its black window open.
Mac: double-click Start_QuikKart_Mac.command. The first time, macOS may refuse
     to open a downloaded script: right-click it, choose Open, then Open again.
Both need Python 3 (python.org). The server listens on this computer only
(127.0.0.1); nothing is reachable from the network. If port 8000 is busy,
close the other program or run:  python -m http.server 8001 --bind 127.0.0.1
and open http://localhost:8001/QuikKart_Stimulus_App.html

Double-clicking the HTML file also works for everything except webcam tracking
offline: opened as a file, the app loads WebGazer from cdn.jsdelivr.net, so it
needs the internet. Served by the start script, it loads ./webcam (offline).

Use Chrome or Edge, full screen (F11). The phone is scaled to fit the window:
scale = min((window height - 40) / 935, (window width - 40) / 432). At
1920 x 1080 full screen every screen sits at exactly the pixels of the PNGs.


3. ADDRESSES (URL MODES)
------------------------
(no parameters)                               Researcher console
?mode=view&arm=A&trial=S1&screen=bill         One screen (listing, cart, bill
                                              or edit). Forward buttons work.
                                              Add &aoi=1 to draw the AOIs.
?mode=run&pid=P001&arm=A&list=A&et=none       Full session. et = none, webcam
         &cm=34.5&dist=60&dot=1               or mouse. cm = screen width,
                                              dist = viewing distance (both cm).
                                              dot=1 shows the gaze dot (demo).
?mode=fix  /  ?mode=blank                     Fixation cross / blank mask.

arm and list can be left out when the pid ends in a number: odd numbers get
arm A, even numbers arm B, and within each arm the lists alternate A, B, A, ...
(P001 A/A, P002 B/A, P003 A/B, P004 B/B, P005 A/A, ...).

The URL hash changes on every screen: #{order}-{trial}-{screen}, for example
#3-S2-bill. order is 0 for the practice trial and 1-8 for test trials (0 in
view mode). Pages outside a trial use the trial name "none" (welcome,
practicedone, camera, calibration, check, end).

In the page, window.getAOIs() returns {aoi, x, y, w, h, fee, click_zone} for
the current screen in viewport pixels, and window.trialOrder(pid, arm, list)
returns the 8 test trials in that participant's order.


4. A SESSION (RUN MODE)
-----------------------
1. Eye-tracking set-up (webcam only, section 7).
2. Welcome page with the cover story ("We are testing the usability of a new
   grocery delivery app..."). The first order is a practice.
3. P0 (practice), then the 8 test trials in a random order. The order is a
   Fisher-Yates shuffle driven by a seeded PRNG: cyrb128 hash of pid+arm+list,
   then mulberry32. The same pid, arm and list always give the same order, and
   trial_orders_P001-P080.csv was made with the same code.
4. Each trial: fixation cross 800 ms, listing, cart, bill, [editing], blank
   500 ms, then one probe:
   - recall on P0 and on the 4 trials of the participant's list (list A:
     S1 S3 L2 L4; list B: S2 S4 L1 L3): "How much in total (₹) would you pay
     for this order, including everything?" (number), then "How sure are
     you?" from 1 (Not at all sure) to 5 (Completely sure);
   - on the other 4 trials, the filler question, typed.
5. "Practice done" after P0. With webcam tracking, a check runs before trial 5.
6. End page: the behaviour CSV (and the gaze CSV when tracking was on)
   download automatically; buttons download them again. The behaviour data
   is also saved in the browser after every trial, under quikkart_<pid>, so
   the console can download it later, even after a crash. Gaze data lives
   only in memory until that download (it is too big for browser storage).
   The console warns before a new session would overwrite a saved one.


5. THE EDITING PHASE
--------------------
On the bill, "Add more items" opens the edit screen: the trial's items, then
the suggested product (cookies when the trial has none), then the other
products, each with ADD or a live "- n +" stepper (0 to 9). A progress card
shows how much more is needed for free delivery. Fees and the cart bar (in the
arm's own format) update live; "View bill" is disabled while the cart is empty.
View bill shows the bill rebuilt from the edited cart with the same three
decisions; Add more items goes round again. Screens are labelled edit1, bill2,
edit2, bill3, ... in the gaze data and the URL hash.

Example: S1 (B 118, F 66, T 184) plus one pack of cookies (Rs 90) gives
B 208: delivery and small-cart fees drop, F 16, T 224, added_value 90,
fee_change -50.

The editing phase exists only in the live app, not in the PNG images.


6. TOBII PRO LAB (IMAGE STIMULI)
--------------------------------
1. Use a 1920 x 1080 stimulus display and add the images in stimuli_png/.
2. Build each participant's timeline from trial_orders_P001-P080.csv: P0 first,
   then order_1 ... order_8. Each trial is fixation.png (800 ms),
   {arm}_{trial}_1_listing.png, _2_cart.png, _3_bill.png, blank_mask.png
   (500 ms). End the listing, cart and bill images on a mouse click.
3. Draw rectangle AOIs from AOI_coordinates.csv (x, y = top-left corner; w, h =
   size; image pixels). aoi_preview/ shows them. Bill images are identical in
   both arms, so one set of bill AOIs serves both.
4. Code the bill decision from the mouse-click position: the rows with
   click_zone = 1 are BTN_ORDER (Place order), BTN_ADD (Add more items) and
   BTN_EXIT (Leave checkout).
5. Static images cannot show the editing phase or the probes. To capture them,
   run the live app (run mode, et=none) in Chrome full screen at 1920 x 1080
   and record it with a Pro Lab screen recording. First-pass screens are then
   at the same pixels as the images; the URL hash and the behaviour CSV give
   the screen times. Ask the probe questions in the app or on paper.


7. WEBCAM EYE TRACKING (LAPTOP)
-------------------------------
Choose "Webcam" in the console (et=webcam; the default) and start the app with
the start script. The camera turns on only in a session, when the participant
clicks "Start camera"; with eye tracking set to None or Mouse it stays off.
Use "Test camera" in the console before the participant arrives: it shows the
camera picture and checks that WebGazer and its face model can be loaded.
Webcam tracking uses WebGazer 3.5.3 (ridge regression, Kalman filter, no data
kept between sessions). No video is recorded, stored or uploaded: frames are
processed in the browser and discarded.
1. Camera check: the video appears at the top with the face outline and box.
   "Continue" unlocks once a face is found; "Researcher: continue anyway"
   skips the check.
2. Calibration: 9 red dots (10/50/90 % of the screen) in random order; the
   participant clicks each one 5 times while looking at it, and it turns
   green. Mouse clicks train WebGazer only during calibration.
3. Validation: 5 black dots at (50,50), (25,25), (75,25), (25,75), (75,75) %,
   2 s each, using samples from the last 1.2 s. Accuracy = mean distance from
   the mean gaze to the target; precision = RMS spread around the mean gaze.
   Degrees = atan(px x (screen width cm / screen.width px) / distance cm).
   Good <= 3 deg, usable <= 4.5 deg, poor above that or with no data.
   The researcher chooses Continue or Recalibrate.
4. Before trial 5 the validation runs again; above 4.5 deg it recalibrates
   automatically.
Every gaze estimate (about 30 per second on a laptop with a working GPU) is
logged while a phone screen is shown. Keep hardware acceleration on in the
browser: without a GPU the face mesh runs slowly and the app feels sluggish.
et=mouse logs the cursor every 33 ms as if it were gaze, to test the pipeline.

If the camera does not turn on, the screen names the cause and the fix:
- Eye tracking set to None or Mouse: the camera is not used. Choose Webcam.
- Camera access was blocked: click the camera icon at the right of the address
  bar, choose Allow, then Try again. On a Mac, also allow the browser in
  System Settings > Privacy & Security > Camera.
- The camera is busy: close Zoom, Teams or the Camera app, then Try again.
- No camera was found: connect a webcam or open its privacy shutter.
- Shown inside another page (an app's file preview, for example): open
  QuikKart_Stimulus_App.html in its own browser tab.
- Opened as a file without internet (or jsDelivr is blocked): the camera works
  but WebGazer cannot be downloaded. Use the start script; it works offline.
Loading gives up after 45 s (the script) or 90 s (the face model) with a
message instead of waiting forever.


8. ACCURACY LIMITS: READ BEFORE ANALYSING
-----------------------------------------
Tobii Pro desktop trackers: about 0.5 deg. Webcam (WebGazer): typically 2-4 deg.
At 1920 x 1080 on a 34.5 cm wide screen viewed from 60 cm, 1 deg = 58 px.
Each fee row is 62 px tall (about 1.1 deg) and the whole fee block 187-249 px.
So the Tobii can separate fee lines; the webcam CANNOT. With webcam data,
analyse only the coarse groups (FEES, TOTAL, BASE, SAVINGS, NUDGE, BUTTONS),
and treat even FEES vs TOTAL vs BASE with caution: they are neighbours on the
bill and a 3 deg error spans about three rows. Report the validation accuracy
(wc_cal_acc_deg) and exclude or down-weight poor calibrations.


9. DATA FILES
-------------
Behaviour CSV (one row per trial, 9 rows), columns in order:
  pid, arm, list            participant, arm (A drip, B upfront), probe list
  trial_id, trial_order     P0 or S1-S4 / L1-L4; 0 = practice, 1-8 test order
  basket                    Small or Large
  B, F, T                   item total, all fees, total of the starting cart
  listing_ms, cart_ms, bill_ms
                            time on each first-pass screen (render to leaving)
  decision                  first-pass bill choice: Place order, Add item, Exit
  dec_rt_ms                 first painted frame of the bill to the click
  edit_rounds               times the edit screen was opened
  edit_ms, rebill_ms        total time on edit screens / on rebuilt bills
  final_decision            last bill choice: Place order or Exit
  final_B, final_F, final_T totals of the final cart
  added_value               final_B - B
  fee_change                final_F - F
  free_delivery_unlocked    1 if delivery was charged at first but not at the end
  small_cart_fee_removed    1 if the small-cart fee was charged at first but not
                            at the end
  cart_changes              net change per product, e.g. cookies:+1|eggs:-1
  edit_clicks               ADD / + / - clicks on edit screens
  probe_type                recall or filler
  probe_question            the question shown
  recall_T                  the participant's recalled total (recall trials)
  recall_ref_T              final_T, the value recall is scored against
  filler_answer             typed answer (filler trials)
  filler_correct_answer     the correct answer
  conf                      confidence 1-5 (recall trials)
  probe_rt_s                probe onset to the answer, seconds (recall: the
                            amount, not the confidence rating)
  et_mode                   none, webcam or mouse
  wc_cal_acc_deg            latest validation accuracy, degrees (webcam)
  wc_bill_samples           gaze samples on the first-pass bill
  wc_bill_valid_pct         % of those samples with a gaze estimate (face found)
  wc_fees_hit               1 if any sample fell in FEES
  wc_fees_ttff_ms           bill onset to the first FEES sample
  wc_fees_ms, wc_total_ms, wc_savings_ms, wc_nudge_ms, wc_buttons_ms
                            dwell per group on the first-pass bill: the sum of
                            intervals between samples, each capped at 100 ms
  trial_start_iso           trial start (fixation onset), ISO 8601 UTC
All wc_* columns come from the first-pass bill only.

Gaze CSV (one row per sample): pid, arm, trial_id, trial_order, screen
(listing, cart, bill, edit1, bill2, ...), t_ms (from screen onset), x, y
(viewport px; empty when no face), aoi (smallest AOI containing the point),
aoi_group:
  FEES         union rectangle of BIL_DEL, BIL_HND, BIL_SCF, BIL_PLT
  TOTAL        BIL_TOT            BASE      BIL_BASE
  SAVINGS      BIL_SAVE           NUDGE     BIL_NUDGE
  BUTTONS      BIL_BTN, BTN_ORDER, BTN_ADD, BTN_EXIT
  PRODUCTS     LST_TILES, CRT_ITEMS, EDT_LIST
  FEE_INFO     LST_FEEBAN, CRT_ALLIN
  SUBTOTAL     CRT_SUB            PAYBAR    CRT_PAYBAR
  CARTBAR      LST_CARTBAR, EDT_CARTBAR
  PHONE_OTHER  inside the phone but in no AOI
  OFF_PHONE    outside the phone
  NO_FACE      no gaze estimate (face not found)

AOI_coordinates.csv: image, arm, trial, screen, aoi, x, y, w, h (image px),
fee_rupees (the fee in that row, 0 when free; empty for non-fee AOIs),
click_zone (1 = clickable button or bar).

trial_orders_P001-P080.csv: pid, arm, list, recall_trials (the 4 test trials
with a recall probe; P0 is always recall too), order_1 ... order_8.

CSV files are UTF-8 without a byte-order mark. In Excel, use Data > From
Text/CSV and choose UTF-8 so the rupee sign shows correctly.


10. BASKETS AND FEES
--------------------
Delivery Rs 30 below Rs 199; small-cart fee Rs 20 below Rs 149; handling Rs 11
and platform Rs 5 on every order. F = all fees; T = B + F. Savings on the bill
= MRP total - B.

{{BASKETS}}


11. REBUILDING
--------------
The source is a Node project (src/, scripts/, tests/). With Node 20+:
  npm install          dependencies (WebGazer, Roboto, Playwright)
  npm run build        dist/QuikKart_Stimulus_App.html and dist/webcam/
  npm run render       build, then the PNGs, CSVs, start scripts, this README
                       and QuikKart_Stimulus_Pack.zip
  npm test             unit tests, render, then the Playwright tests


12. LICENCES
------------
webcam/webgazer.js: WebGazer.js, GPL-3.0-or-later (webcam/LICENSE.md and
webcam/GPL-3.0.txt; source at github.com/brownhci/WebGazer).
webcam/mediapipe/face_mesh: MediaPipe, Apache-2.0.
Roboto font (embedded in the HTML): SIL Open Font License 1.1 (licences/).
Product pictures are simple generic drawings; no real brands are shown.
