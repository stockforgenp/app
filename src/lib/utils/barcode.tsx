/**
 * Lightweight Zero-Dependency Code 128B Barcode Generator
 * Generates SVG path / rectangle data for standard retail barcode labels and shelf tags.
 */

// Standard Code 128 patterns (widths of alternate bars and spaces: 3 bars, 3 spaces)
const CODE128_PATTERNS: string[] = [
  "212222",
  "222122",
  "222221",
  "121223",
  "121322",
  "131222",
  "122213",
  "122312",
  "132212",
  "221213", // 0-9
  "221312",
  "231212",
  "112232",
  "122132",
  "122231",
  "113222",
  "123122",
  "123221",
  "223211",
  "221132", // 10-19
  "221231",
  "213212",
  "223112",
  "312131",
  "311222",
  "321122",
  "321221",
  "312212",
  "322112",
  "322211", // 20-29
  "212123",
  "212321",
  "232121",
  "111323",
  "131123",
  "131321",
  "112313",
  "132113",
  "132311",
  "211313", // 30-39
  "231113",
  "231311",
  "112133",
  "112331",
  "132131",
  "113123",
  "113321",
  "133121",
  "313121",
  "211331", // 40-49
  "231131",
  "213113",
  "213311",
  "213131",
  "311123",
  "311321",
  "331121",
  "312113",
  "312311",
  "332111", // 50-59
  "314111",
  "221411",
  "431111",
  "111224",
  "111422",
  "121124",
  "121421",
  "141122",
  "141221",
  "112214", // 60-69
  "112412",
  "122114",
  "122411",
  "142112",
  "142211",
  "241211",
  "221114",
  "413111",
  "241112",
  "134111", // 70-79
  "111242",
  "121142",
  "121241",
  "114212",
  "124112",
  "124211",
  "411212",
  "421112",
  "421211",
  "212141", // 80-89
  "214121",
  "412121",
  "111143",
  "111341",
  "131141",
  "114113",
  "114311",
  "411113",
  "411311",
  "113141", // 90-99
  "114131",
  "311141",
  "411131",
  "211412",
  "211214",
  "211232",
  "2331112", // 100-106 (106 is STOP)
];

const START_CODE_B = 104;
const STOP_CODE = 106;

/**
 * Encodes an ASCII string to Code 128B binary sequence (1 = bar, 0 = space)
 */
export function encodeCode128B(text: string): string {
  if (!text) text = "0000";

  const chars: number[] = [];
  let checksum = START_CODE_B;

  // Add Start B
  chars.push(START_CODE_B);

  // Encode each char
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    const charCode = code >= 0 && code <= 95 ? code : 0;
    chars.push(charCode);
    checksum += charCode * (i + 1);
  }

  // Add Checksum
  chars.push(checksum % 103);

  // Add Stop
  chars.push(STOP_CODE);

  // Convert pattern widths to binary pulses
  let binary = "0000000000"; // Quiet zone
  for (let i = 0; i < chars.length; i++) {
    const pattern = CODE128_PATTERNS[chars[i]];
    if (!pattern) continue;

    let isBar = true;
    for (let j = 0; j < pattern.length; j++) {
      const width = parseInt(pattern[j], 10);
      binary += (isBar ? "1" : "0").repeat(width);
      isBar = !isBar;
    }
  }
  binary += "0000000000"; // Quiet zone

  return binary;
}

export interface BarcodeSvgProps {
  text: string;
  width?: number | string;
  height?: number;
  showText?: boolean;
  className?: string;
}

/**
 * React Component to render crisp vector SVG barcode
 */
import React from "react";

export const BarcodeSvg: React.FC<BarcodeSvgProps> = ({
  text,
  width = "100%",
  height = 42,
  showText = true,
  className = "",
}) => {
  const binary = encodeCode128B(text);
  const totalModules = binary.length;

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <svg
        viewBox={`0 0 ${totalModules} ${height}`}
        style={{ width, height: `${height}px`, display: "block" }}
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width={totalModules} height={height} fill="#FFFFFF" />
        {binary.split("").map((bit, idx) => {
          if (bit === "1") {
            return (
              <rect
                key={idx}
                x={idx}
                y={0}
                width={1.05}
                height={height}
                fill="#000000"
              />
            );
          }
          return null;
        })}
      </svg>
      {showText && (
        <span className="text-[10px] font-mono tracking-widest text-neutral-900 mt-0.5 font-bold uppercase">
          {text}
        </span>
      )}
    </div>
  );
};
