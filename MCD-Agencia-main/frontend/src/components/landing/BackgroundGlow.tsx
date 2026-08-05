/**
 * Background Glow Component
 *
 * Creates color glows (cyan, magenta, yellow) distributed in
 * alternating horizontal rows across the full page height.
 * Pattern: right → left → right → left → ...
 * Each glow is slightly offset from its respective edge.
 */

const GLOWS = [
  // Start glows at ~mid-Portfolio section ("Trabajos que hablan por nosotros")
  // Row 1 - Magenta (left)
  { color: 'bg-cmyk-magenta/20', top: '28%', side: 'left', offset: '3%' },
  // Row 2 - Yellow (right)
  { color: 'bg-cmyk-yellow/20', top: '36%', side: 'right', offset: '5%' },
  // Row 3 - Cyan (left)
  { color: 'bg-cmyk-cyan/20', top: '44%', side: 'left', offset: '2%' },
  // Row 4 - Magenta (right)
  { color: 'bg-cmyk-magenta/20', top: '52%', side: 'right', offset: '4%' },
  // Row 5 - Yellow (left)
  { color: 'bg-cmyk-yellow/20', top: '60%', side: 'left', offset: '3%' },
  // Row 6 - Cyan (right)
  { color: 'bg-cmyk-cyan/20', top: '68%', side: 'right', offset: '5%' },
  // Row 7 - Magenta (left)
  { color: 'bg-cmyk-magenta/20', top: '76%', side: 'left', offset: '2%' },
  // Row 8 - Yellow (right)
  { color: 'bg-cmyk-yellow/20', top: '84%', side: 'right', offset: '3%' },
];

export function BackgroundGlow() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {GLOWS.map((glow, i) => (
        <div
          key={i}
          className={`absolute w-[420px] h-[350px] ${glow.color} rounded-full blur-[120px]`}
          style={{
            top: glow.top,
            ...(glow.side === 'right'
              ? { right: glow.offset }
              : { left: glow.offset }),
          }}
        />
      ))}
    </div>
  );
}
