# תוכנית – Milestone 2: משחק מלא מקצה לקצה

> מבוסס על `MILESTONES.md` (Milestone 2), `PRD.md` §3–§4.2, `ARCHITECTURE.md` §2.3–§2.6 ו-ADR-1, ADR-2, ADR-3 (החלק של `abandon`) ו-ADR-5, ועל `DESIGN.md` §1.1 (מצבי תצוגה וטבלת "קצב הצגת הרצף") ו-§2.3–§2.4. נקודת המוצא היא הקוד הקיים אחרי Milestone 1.

## 1. מטרה ותחום

לממש משחק אמיתי: "התחל משחק" ← הצגת רצף (הארה + צליל) ← תור השחקן ← מעבר שלב / הפסד / ניצחון ← הודעת סיום עם "אישור" ← חזרה למצב "לפני תחילת משחק".

**בתחום:** Reducer עם `idle`, `presenting`, `awaitingInput`, `won`, `lost`; Sequence Controller עם ביטול; Audio Engine (Web Audio API); קלט ב-`pointerdown` עם מגע יחיד; הודעת סיום (Dialog) עם "אישור"; קונפטי בניצחון בלבד (כולל גרסה מצומצמת ל-`prefers-reduced-motion`); הודעת שגיאה כשהצליל לא מצליח להתחיל; ביטול משחק במעבר ל"אודות" (Action זמני `abandon`).

**מחוץ לתחום (לא לבנות עכשיו):** מצב `paused`, "המשך משחק", `visibilitychange`/`pagehide` (Milestone 3); שמירת היסטוריה ב-`localStorage` ושינויים במסך אודות (Milestone 4); PWA ופריסה (Milestone 5). `gameId` נשמר כבר עכשיו ב-State (ADR-5), אבל אין עדיין שמירת תוצאה.

## 2. Dependencies

- להוסיף `canvas-confetti` (dependency) ו-`@types/canvas-confetti` (devDependency). להריץ `npm audit` אחרי ההתקנה.
- אין Dependencies נוספות (אודיו = Web Audio API מובנה, בלי Tone.js).

## 3. קבצים ליצירה / שינוי

| קובץ | פעולה | תוכן |
|---|---|---|
| `src/game/colors.ts` | שינוי | להוסיף `COLOR_IDS` (מערך ארבעת המזהים) ו-`getColorLabel(id)`. הסידור והקבוע `TOTAL_ROUNDS` נשארים. |
| `src/game/timing.ts` | חדש | קבועי הקצב מ-`DESIGN.md` §1.1 (ראה §5). |
| `src/game/random.ts` | חדש | `randomColor(): ColorId` עם `Math.random()` (ADR-2). מודול נפרד כדי שבבדיקות אפשר להחליף אותו. |
| `src/game/gameReducer.ts` | חדש | `GameState`, `GameAction`, `initialGameState`, `gameReducer` – טהור, בלי אודיו/Timers (ראה §4). |
| `src/game/gameReducer.test.ts` | חדש | בדיקות יחידה ל-Reducer. |
| `src/game/sequencePlayer.ts` | חדש | `playPresentation(...)` – פונקציה אסינכרונית שמריצה את ההמתנות וההצגה ונעצרת מיד על `AbortSignal` (ראה §6). |
| `src/game/sequencePlayer.test.ts` | חדש | בדיקת קצב והתנהגות ביטול עם Fake Timers. |
| `src/audio/audioEngine.ts` | חדש | ניהול `AudioContext`, צלילי צבעים, צלילי ניצחון/הפסד, עצירה (ראה §7). |
| `src/effects/confetti.ts` | חדש | `fireWinConfetti(): () => void` – מפעיל קונפטי ומחזיר Cleanup (ראה §9). |
| `src/hooks/useGame.ts` | חדש | מחבר Reducer + Controller + אודיו + קלט + חשיפת הודעת הסיום. נמצא ב-`App` (ADR-2). |
| `src/components/SimonBoard.tsx` | שינוי | לוח אינטראקטיבי: Props למצב, רבע מואר, קלט (ראה §8). |
| `src/components/EndDialog.tsx` | חדש | Dialog הסיום (ניצחון/הפסד) עם "אישור" ופוקוס עליו. |
| `src/screens/HomeScreen.tsx` | שינוי | מקבל את מצב המשחק מ-`useGame` ומציג חיווי שלב, סטטוס, הנחיה, כפתור והודעת סיום לפי המצב. |
| `src/App.tsx` | שינוי | מחזיק את `useGame`; בניווט ל"אודות" במשחק פעיל קורא ל-`game.abandon()`. |
| `src/styles/components.css` | שינוי | Glow, עמעום, Disabled, Overlay/Dialog, הודעת שגיאה, הנחיה מתחת ללוח. |
| `src/App.test.tsx` | שינוי | לשמור את בדיקות M1 (מותאמות ל-Props החדשים) ולהוסיף בדיקות אינטגרציה של משחק (ראה §11). |
| `src/test/setup.ts` | שינוי (אם צריך) | Mock גלובלי ל-`matchMedia` (jsdom לא מספק אותו). |
| `spec/ARCHITECTURE.md` | הוספת ADR | ADR-11 על חיווי השלב בזמן המעבר בין שלבים ועל דחיית חשיפת הודעת הסיום (ראה §12). |

## 4. Game Reducer (`src/game/gameReducer.ts`)

```ts
type GameStatus = 'idle' | 'presenting' | 'awaitingInput' | 'won' | 'lost';
type PresentationKind = 'start' | 'nextRound';

type GameState = {
  status: GameStatus;
  sequence: ColorId[];        // length 1–10
  round: number;              // 1–10 (1 in idle)
  inputIndex: number;
  completedRounds: number;    // 0–10
  gameId: number;             // increments on every start
  presentationId: number;     // increments on every new presentation / cancel
  presentationKind: PresentationKind;
};

type GameAction =
  | { type: 'start'; firstColor: ColorId }
  | { type: 'presentationDone'; presentationId: number }
  | { type: 'press'; color: ColorId; nextColor: ColorId }
  | { type: 'dismiss' }
  | { type: 'abandon' };      // temporary, M2 only (ADR-3)
```

כללי מעבר (כל Action שלא חוקי במצב הנוכחי מחזיר את אותו אובייקט State בדיוק – בלי שינוי):

- **`start`** – רק מ-`idle`: `sequence=[firstColor]`, `round=1`, `inputIndex=0`, `completedRounds=0`, `gameId+1`, `presentationId+1`, `presentationKind='start'`, `status='presenting'`.
- **`presentationDone`** – רק מ-`presenting` ורק אם `presentationId` תואם (סיום מיושן מתעלם): `status='awaitingInput'`, `inputIndex=0`.
- **`press`** – רק מ-`awaitingInput`:
  - צבע שגוי ← `status='lost'`, `completedRounds=round-1` (0 בשלב 1).
  - צבע נכון, לא אחרון ברצף ← `inputIndex+1` בלבד.
  - צבע נכון ואחרון, `round<10` ← `completedRounds=round`, `round+1`, `sequence=[...sequence, nextColor]`, `inputIndex=0`, `presentationId+1`, `presentationKind='nextRound'`, `status='presenting'` (ARCHITECTURE §2.3 כלל 10).
  - צבע נכון ואחרון, `round===10` ← `completedRounds=10`, `status='won'`. אין שלב 11.
  - `nextColor` מגיע תמיד מבחוץ (ה-Hook מגריל אותו), כך שה-Reducer דטרמיניסטי.
- **`dismiss`** – רק מ-`won`/`lost`: חזרה ל-`initialGameState` תוך שמירת `gameId` ו-`presentationId` (ADR-5).
- **`abandon`** – רק מ-`presenting`/`awaitingInput`: כמו `dismiss` (חזרה ל-`idle`, `presentationId+1` כדי שכל Playback פתוח יתעלם). לא נוגעים במשחק שהסתיים.

## 5. קבועי קצב (`src/game/timing.ts`)

ערכים מחייבים מ-`DESIGN.md` §1.1, זהים בכל השלבים:

```ts
export const FLASH_MS = 600;            // highlight + tone per sequence color
export const GAP_MS = 250;              // pause between sequence colors
export const LEAD_IN_MS = 1000;         // before first color after "התחל משחק"
export const ROUND_DONE_HOLD_MS = 1000; // completed round number stays visible
export const NEXT_ROUND_LEAD_MS = 1000; // after showing next round number, before first color
export const END_REVEAL_DELAY_MS = 1000;// after last press until win/loss dialog + sound
export const PRESS_MIN_MS = 300;        // minimum player press feedback
```

## 6. Sequence Controller (`src/game/sequencePlayer.ts` + Effect ב-`useGame`)

`playPresentation({ sequence, kind, signal, waitForPressEnd, onDisplayRoundAdvance, onHighlight, playTone })`:

1. `await waitForPressEnd()` – ההמתנות שאחרי לחיצה נמדדות מסוף משוב הלחיצה (DESIGN §1.1). בהתחלת משחק אין לחיצה פעילה, וזה מסתיים מיד.
2. `kind==='start'`: `sleep(LEAD_IN_MS)`.
   `kind==='nextRound'`: `sleep(ROUND_DONE_HOLD_MS)` ← `onDisplayRoundAdvance()` (חיווי השלב מתחלף לשלב הבא) ← `sleep(NEXT_ROUND_LEAD_MS)`.
3. לכל צבע: `onHighlight(color)` + `playTone(color, FLASH_MS)` ← `sleep(FLASH_MS)` ← `onHighlight(null)` ← אם לא אחרון: `sleep(GAP_MS)`.
4. מחזירה בהצלחה; ה-Effect שולח `presentationDone` עם ה-`presentationId` שלו.

- `sleep(ms, signal)` דוחה (reject) מיד כשה-`signal` מבוטל ומנקה את ה-`setTimeout`.
- ב-`useGame`: Effect שתלוי ב-`presentationId` ופועל רק כש-`status==='presenting'`; יוצר `AbortController`, ובפונקציית ה-Cleanup: `abort()`, כיבוי הארה ו-`audio.stopAll()`. כך גם React Strict Mode (Effect רץ פעמיים בפיתוח) מתחיל הצגה נקייה אחת.
- **חיווי השלב (`displayRound`)**: ב-`useGame` State נפרד. בהצגה מסוג `nextRound` הוא מתחיל ב-`round-1` ומתעדכן ל-`round` ב-`onDisplayRoundAdvance`; בכל מצב אחר הוא שווה ל-`round`. בסיום משחק החיווי נשאר על השלב האחרון שהיה פעיל (DESIGN §1.1).

## 7. Audio Engine (`src/audio/audioEngine.ts`)

- `unlockAudio(): Promise<boolean>` – יוצר `AudioContext` בפעם הראשונה (סינכרונית, בתוך ה-Gesture) וקורא ל-`resume()`. מחזיר `true` רק אם `state === 'running'`; אם `AudioContext` לא קיים או `resume()` נכשל – `false`.
- `startTone(color): () => void` – Oscillator + GainNode עם Envelope קצר (Attack/Release של ~10ms, למניעת קליקים); מחזיר פונקציית עצירה. משמש לחיצת שחקן (צליל נמשך כל עוד לוחצים).
- `playTone(color, durationMs)` – צליל באורך קבוע (להצגת הרצף).
- ארבעה גבהי צליל שונים, בהשראת ה-Simon המקורי: ירוק `415Hz`, אדום `310Hz`, צהוב `252Hz`, כחול `209Hz` (גל `triangle`/`sine`).
- `playWinSound()` – מוטיב עולה קצר (ארפג'יו C5‏–E5‏–G5‏–C6). `playLoseSound()` – צליל נמוך ויורד (~`180Hz`←`90Hz`, ~600ms). שני מוטיבים נבדלים מצלילי הצבעים.
- `stopAll()` – עוצר כל Oscillator פעיל (נשמר ב-Set).
- המודול עצמו לא מכיר את React או את ה-Reducer (ARCHITECTURE §2.3 כלל 4).

**כשל בהתחלת הצליל:** בלחיצה על "התחל משחק" `useGame.start()` קורא ל-`unlockAudio()` **לפני** שליחת `start`. אם החזיר `false`: לא מתחילים משחק (נשארים ב-`idle`, בלי רצף שקט), ומוצגת הודעה מתחת לכפתור (`role="alert"`): **"לא הצלחנו להפעיל את הצלילים. לחצו שוב על "התחל משחק"."** (נוסח מוצע – ה-spec מחייב הודעה בעברית אבל לא קובע ניסוח; לאשר לפני הבנייה). ההודעה נעלמת בלחיצה הבאה. "אישור" אינו Gesture אודיו (ADR-5).

## 8. קלט ולוח (`SimonBoard.tsx` + `useGame`)

Props: `litColor: ColorId | null`, `mode: 'idle' | 'presenting' | 'input' | 'ended'`, `onPressStart(color)`.

- **מראה לפי DESIGN §1.1 וה-Mockups:**
  - `idle` – לוח מלא בצבעיו (כמו היום).
  - `presenting` – כל הרבעים מעומעמים (`filter: brightness(.45) saturate(.7)`); הרבע המואר מקבל `is-lit`: צבע מלא ובהיר + `box-shadow`/`filter: drop-shadow` בצבע הרבע (Glow).
  - `input` – צבעים מלאים; רבע לחוץ מקבל `is-lit` (Glow).
  - `ended` – כמו `idle`, מתחת ל-Overlay.
- הכפתורים `disabled` בכל מצב חוץ מ-`input` (חסימת קלט בזמן הצגה); ה-Reducer מתעלם גם הוא מ-`press` שלא ב-`awaitingInput`.
- **`pointerdown`** (ADR-2): `preventDefault()`, ואם אין לחיצה פעילה – `useGame.pressStart(color, pointerId)`:
  1. מגריל `nextColor`, שולח `press` ל-Reducer.
  2. מאיר את הרבע ומפעיל `startTone(color)` – **גם בלחיצה שגויה** (PRD 4.2).
  3. שומר "לחיצה פעילה" ב-`ref` עם זמן התחלה ו-Promise שמסתיים בסוף המשוב.
- **שחרור:** מאזינים ל-`pointerup`/`pointercancel` על `window` (הרבע עלול להיות `disabled` בינתיים). סוף המשוב = המאוחר מבין השחרור ו-`PRESS_MIN_MS` מתחילת הלחיצה; אז מכבים הארה, עוצרים את הצליל ופותרים את ה-Promise (משמש את `waitForPressEnd` ואת השהיית הודעת הסיום).
- **מגע יחיד** (§2.3 כלל 11): `pointerdown` נוסף בזמן שיש לחיצה פעילה – מתעלמים.
- **מקלדת:** Enter/Space על רבע ← לחיצה של `PRESS_MIN_MS` בדיוק (נגישות).
- `aria-label` בעברית נשאר על כל רבע (קיים). מצב המשחק לא מועבר בצבע בלבד – יש טקסט סטטוס.

## 9. מסך הבית והודעת הסיום

**`HomeScreen` לפי מצב (DESIGN §1.1, Wireframes):**

| מצב | חיווי שלב | סטטוס (מעל הלוח, `aria-live="polite"`) | מתחת ללוח | כפתור |
|---|---|---|---|---|
| `idle` | "שלב 1 מתוך 10" | ריק | הודעת שגיאת אודיו, אם יש | **"התחל משחק"** |
| `presenting` | `displayRound` | "המשחק מציג את הרצף" | "המתן..." | אין |
| `awaitingInput` | `round` | "התור שלך" | "הקש על הצבעים לפי הסדר" | אין |
| `won`/`lost` לפני חשיפה | השלב האחרון | ריק | – | אין |
| `won`/`lost` אחרי חשיפה | השלב האחרון | – | Overlay מעל הלוח | "אישור" בתוך ה-Dialog |

**חשיפת הודעת הסיום (`endRevealed` ב-`useGame`):** בכניסה ל-`won`/`lost` מחכים לסוף משוב הלחיצה ואז `END_REVEAL_DELAY_MS`, ואז בבת אחת: `endRevealed=true` + צליל ניצחון/הפסד (ובניצחון – קונפטי, דרך `EndDialog`). Timer ניתן לביטול; מתאפס ב-`dismiss`.
- **מעבר ל"אודות" בזמן ההמתנה הזו:** התוצאה כבר נקבעה (PRD Edge Cases), ולכן לא מבטלים את המשחק. ה-Timer מבוטל, וכשחוזרים לבית ההודעה נחשפת מיד (עם צליל וקונפטי). `HomeScreen` קורא ל-`game.revealEnd()` בעלייה אם `status` הוא `won`/`lost` ו-`endRevealed=false`.

**`EndDialog`:**
- Overlay בתוך אזור הלוח (הלוח נשאר מזוהה ברקע), כרטיס `Surface` עם גבול `Border` ופינות מעוגלות, `role="dialog"`, `aria-modal="true"`, `aria-labelledby` לכותרת; פוקוס אוטומטי על **"אישור"** (ARCHITECTURE §2.4).
- **ניצחון:** "כל הכבוד!" (ירוק) ו-"ניצחת!" (לבן) בשורות נפרדות, H1.
- **הפסד:** "נפסלת!" (אדום, H1) ומתחת חיווי שלבים שהושלמו: 0 ← "לא השלמת אף שלב"; 1 ← "השלמת שלב אחד"; 2–9 ← "השלמת N שלבים".
- כפתור ראשי כחול **"אישור"** ← `dismiss` ← מצב `idle` עם "התחל משחק" ו-"שלב 1 מתוך 10". (ה-Mockups מציגים "שחק שוב" – הוחלף ב-"אישור" לפי PRD ו-ADR-5.)

**קונפטי (`src/effects/confetti.ts`):** מופעל ב-`useEffect` של `EndDialog` רק כש-`outcome==='win'`; ה-Cleanup קורא `confetti.reset()`. צבעי החלקיקים: ארבעת צבעי המשחק. `prefers-reduced-motion: reduce` ← עדיין מופעל, אבל בגרסה מצומצמת: התפרצות אחת, ~25 חלקיקים, `ticks` נמוך, בלי התפרצויות חוזרות. **לא** להשתמש ב-`disableForReducedMotion` (ARCHITECTURE §2.4). בהפסד – לא נקרא כלל.

## 10. `useGame` (`src/hooks/useGame.ts`) – ממשק

```ts
{
  state: GameState;
  displayRound: number;
  litColor: ColorId | null;
  endRevealed: boolean;
  audioError: boolean;
  start(): Promise<void>;      // unlock audio inside the gesture, then dispatch start
  pressStart(color, pointerId?): void;
  dismiss(): void;
  abandon(): void;             // temporary (M2): cancel playback/press/timers, back to idle
  revealEnd(): void;
}
```

**`abandon` (פתרון זמני, Milestone 2):** ב-`App`, `onNavigate('about')` כש-`status` הוא `presenting`/`awaitingInput` ← `game.abandon()`: ביטול ה-`AbortController`, כיבוי הארה, `audio.stopAll()`, שחרור לחיצה פעילה ו-`dispatch({type:'abandon'})`. מסך הבית חוזר ל"לפני תחילת משחק"; אין רישום תוצאה. יוחלף ב-`pause` ב-Milestone 3.

**Refresh:** המצב חי רק ב-Memory (`useReducer`), ולכן Refresh מתחיל תמיד מ-`idle`. אסור לכתוב משהו מהמשחק ל-`localStorage`/`sessionStorage`.

## 11. בדיקות

**Reducer (`gameReducer.test.ts`):**
- `start` יוצר רצף באורך 1 ושלב 1; `start` שלא מ-`idle` לא משנה דבר.
- `press` ב-`presenting` – אין שינוי; `presentationDone` עם מזהה ישן – אין שינוי.
- לחיצה נכונה באמצע מקדמת רק את `inputIndex`.
- השלמת שלב: אורך הרצף גדל ב-1 בדיוק, הרצף הקודם הוא Prefix של החדש, `completedRounds=round` הקודם; אפשרות לצבע חוזר (`nextColor` זהה לאחרון).
- אורכי רצף בשלבים 1, 2 ו-10 הם 1, 2 ו-10.
- הפסד בשלב 1 ← `completedRounds=0`; הפסד בשלב 5 ← `4`.
- השלמת שלב 10 ← `won`, `completedRounds=10`, אין שלב 11 (`press` נוסף ב-`won` לא משנה).
- `dismiss` ← `idle` עם `gameId` שנשמר; `start` הבא מעלה `gameId`.
- `abandon` מ-`presenting`/`awaitingInput` ← `idle`; מ-`won`/`lost` – אין שינוי.

**Sequence Player (`sequencePlayer.test.ts`, Fake Timers):**
- תזמון `onHighlight` תואם לטבלה (1000 ← 600 ← 250 ← 600...), זהה בשלב 2 ובשלב 9.
- `nextRound`: חיווי השלב מתחלף אחרי 1000ms, הצבע הראשון אחרי 1000ms נוספים.
- `abort()` באמצע עוצר מיד: אין `onHighlight` נוסף ואין `presentationDone`.

**אינטגרציה (`App.test.tsx`)** – Mock ל-`audio/audioEngine` (רושם קריאות, `unlockAudio` מחזיר `true`), Mock ל-`effects/confetti`, Mock ל-`game/random` לרצף ידוע, `vi.useFakeTimers()` ו-`fireEvent.pointerDown`/`pointerUp`:
- "התחל משחק" ← סטטוס "המשחק מציג את הרצף", הרבעים `disabled`; לחיצה בזמן הצגה לא משנה דבר.
- אחרי ההצגה ← "התור שלך"; שחזור נכון ← שלב 2 עם רצף באורך 2.
- הפסד בשלב 1: צליל הצבע שנלחץ מושמע מיד; אחרי 1000ms מסוף המשוב – "נפסלת!", "לא השלמת אף שלב", צליל הפסד, **בלי** קונפטי.
- הפסד בשלב מתקדם (למשל שלב 4 ← "השלמת 3 שלבים").
- ניצחון אחרי שלב 10: "כל הכבוד! ניצחת!", צליל ניצחון, קונפטי נקרא פעם אחת; אין שלב 11.
- "אישור" ← "התחל משחק" + "שלב 1 מתוך 10"; "התחל משחק" שוב ← משחק חדש עם רצף חדש (Mock מחזיר צבע אחר).
- `unlockAudio` מחזיר `false` ← הודעת השגיאה מוצגת, המשחק לא מתחיל.
- מעבר ל"אודות" בזמן הצגה ובזמן תור השחקן ← חזרה לבית מציגה "התחל משחק", `stopAll` נקרא, ואחרי קידום ה-Timers אין שינוי מצב/הארה.
- מגע יחיד: `pointerDown` שני בזמן לחיצה פעילה אינו נקלט.
- בדיקות M1 הקיימות ממשיכות לעבור.

**בדיקה ידנית (בדפדפן מובייל או אמולציה, `npm run dev`):** צלילים שונים לארבעת הצבעים, Glow ועמעום, קצב קבוע בין שלבים, הודעות סיום, קונפטי רק בניצחון, Refresh באמצע משחק מחזיר ל"התחל משחק", אין גלילה אופקית. בדיקת אודיו במכשיר אמיתי – לדווח אם לא בוצעה.

## 12. ADR שיתווסף בבנייה

**ADR-11: חיווי השלב במעבר שלב ודחיית חשיפת הודעת הסיום** – ה-Reducer עובר מיד לשלב הבא או ל-`won`/`lost` (§2.3 כלל 10), אבל מה שמוצג על המסך (מספר השלב, ה-Dialog, צליל הסיום, הקונפטי) מתעדכן לפי לוח הזמנים של DESIGN דרך `displayRound` ו-`endRevealed` ב-`useGame`. ההמתנות נמדדות מסוף משוב הלחיצה. מעבר מסכים בזמן ההמתנה לפני הודעת הסיום לא מבטל את התוצאה; ההודעה נחשפת עם החזרה לבית.

## 13. Definition of Done – איך כל תנאי ייבדק

| תנאי | בדיקה |
|---|---|
| התחלה ב-"התחל משחק"; אורכים 1/2/10; Prefix | Reducer + אינטגרציה |
| צלילים שונים והארה נבדלת; קצב קבוע | תדרים שונים ב-Audio Engine; Sequence Player; בדיקה ידנית |
| חסימה ב-`presenting`; לחיצות נכונות מקדמות; שגויה אחת מפסידה | Reducer + אינטגרציה |
| הפסד בשלב 1, הפסד מתקדם, ניצחון, אין שלב 11, רצף חדש אחרי "אישור" | אינטגרציה |
| טקסט וצליל סיום; קונפטי רק בניצחון | אינטגרציה (Mocks) + ידנית |
| Refresh מבטל משחק; אין שמירת מצב | סקירת קוד (אין גישה ל-Storage) + ידנית |
| קצב לפי הטבלה; צליל הצבע מיד ואז צליל הפסד + הודעה אחרי שנייה | Sequence Player + אינטגרציה |
| מעבר ל"אודות" לא משאיר הארה/צליל/Timer | אינטגרציה |
| `npm run typecheck`, `npm run test`, `npm run build` עוברים | הרצה |
