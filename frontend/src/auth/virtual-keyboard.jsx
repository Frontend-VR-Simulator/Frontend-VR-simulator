/* ------------------------------------------------------------------ */
/*  Virtual Keyboard (Compact, VR-optimized)                          */
/* ------------------------------------------------------------------ */
import { useState } from "react";
import { ArrowDown, CaseUpper, Delete, Space } from "lucide-react";

const letterRows = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const numberRows = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["-", "_", "+", "=", "/", "?", "!", "#", "%"],
  ["@", ".", ",", ":", ";", "'", '"'],
];

// Stops the button from stealing focus (and the blinking caret) away
// from whichever text input is currently active.
const keepFocus = (e) => e.preventDefault();

export function VirtualKeyboard({ activeLabel, onKey, onBackspace, onClear, onDone }) {
  const [shift, setShift] = useState(false);
  const [numeric, setNumeric] = useState(false);
  const rows = numeric ? numberRows : letterRows;

  const kBase =
    "h-10 sm:h-11 min-w-[2rem] sm:min-w-[2.5rem] rounded-md bg-zinc-800 " +
    "border border-zinc-700 text-zinc-100 text-sm font-medium " +
    "shadow-sm shadow-black/30 hover:bg-zinc-700 hover:border-zinc-600 " +
    "hover:shadow-md hover:shadow-black/40 active:bg-zinc-600 active:scale-95 " +
    "active:shadow-inner transition-all flex items-center justify-center select-none";

  const kWide = "px-3 sm:px-4";
  const kActive = "bg-zinc-600 border-zinc-500 hover:bg-zinc-500";
  const kSpace = "flex-1 max-w-[10rem]";
  const kClear =
    "text-red-400 hover:text-red-300 hover:bg-red-400/10 border-transparent bg-transparent shadow-none hover:shadow-none active:shadow-none";

  return (
    <section
      className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/40 p-3 sm:p-4"
      aria-label={`On-screen keyboard for ${activeLabel}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="text-xs sm:text-sm">
          <span className="text-zinc-500 mr-2">Now typing</span>
          <strong className="text-zinc-100 font-semibold">{activeLabel}</strong>
        </div>
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={onDone}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs sm:text-sm font-medium hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
        >
          Done
          <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Keys */}
      <div className="flex flex-col gap-1.5" role="group" aria-label="Virtual keys">
        {rows.map((row, rowIndex) => (
          <div className="flex justify-center gap-1 sm:gap-1.5" key={rowIndex}>
            {row.map((key) => (
              <button
                key={key}
                type="button"
                onMouseDown={keepFocus}
                onClick={() => onKey(shift ? key.toUpperCase() : key)}
                aria-label={`Type ${key}`}
                className={kBase}
              >
                {shift ? key.toUpperCase() : key}
              </button>
            ))}
          </div>
        ))}

        {/* Action Row */}
        <div className="flex justify-center gap-1 sm:gap-1.5 mt-0.5">
          <button
            type="button"
            onMouseDown={keepFocus}
            onClick={() => setShift((v) => !v)}
            aria-pressed={shift}
            className={`${kBase} ${kWide} ${shift ? kActive : ""}`}
          >
            <CaseUpper className="w-4 h-4 sm:mr-1" aria-hidden="true" />
            <span className="hidden sm:inline text-xs">Shift</span>
          </button>

          <button
            type="button"
            onMouseDown={keepFocus}
            onClick={() => setNumeric((v) => !v)}
            className={`${kBase} ${kWide}`}
          >
            {numeric ? "ABC" : "123"}
          </button>

          <button
            type="button"
            onMouseDown={keepFocus}
            onClick={() => onKey(" ")}
            aria-label="Type a space"
            className={`${kBase} ${kSpace}`}
          >
            <Space className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onMouseDown={keepFocus}
            onClick={() => onKey("@")}
            aria-label="Type at sign"
            className={kBase}
          >
            @
          </button>

          <button
            type="button"
            onMouseDown={keepFocus}
            onClick={onBackspace}
            className={`${kBase} ${kWide}`}
          >
            <Delete className="w-4 h-4 sm:mr-1" aria-hidden="true" />
            <span className="hidden sm:inline text-xs">Del</span>
          </button>

          <button
            type="button"
            onMouseDown={keepFocus}
            onClick={onClear}
            className={`${kBase} ${kWide} ${kClear}`}
          >
            Clear
          </button>
        </div>
      </div>
    </section>
  );
}
