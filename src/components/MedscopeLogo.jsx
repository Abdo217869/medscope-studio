export function MedscopeLogo({ scriptFont = 'Caveat' }) {
  return (
    <div className="flex flex-col items-center justify-center select-none">
      {/* Golden Falcon Bird Symbol */}
      <img
        src="./assets/medscope-eagle.svg"
        alt="Medscope Eagle"
        className="w-16 h-8 object-contain"
      />
      {/* Brand Text */}
      <span className="text-[10px] tracking-[0.22em] font-black text-[#f0ba3c] uppercase leading-none mt-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
        MEDSCOPE
      </span>
      {/* Tagline */}
      <span
        className="text-[10px] text-[#fae19c] leading-tight mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
        style={{ fontFamily: scriptFont || 'Caveat, cursive' }}
      >
        - Spread your wings
      </span>
    </div>
  );
}
