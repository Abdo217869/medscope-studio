import { useMemo } from 'preact/hooks';

export function SectionPicker({
  sections = [],
  selectedSectionId = 'A1',
  onSelectSection,
  className = '',
  compact = false
}) {
  // Extract sections grouped by letter
  const { letters, sectionsByLetter, activeLetter } = useMemo(() => {
    const lettersSet = new Set();
    const map = {};

    sections.forEach(sec => {
      const l = (sec.letter || (sec.id ? sec.id.match(/^([A-Za-z]+)/)?.[1] : 'A') || 'A').toUpperCase();
      lettersSet.add(l);
      if (!map[l]) map[l] = [];
      map[l].push(sec);
    });

    const allLetters = Array.from(lettersSet);
    const activeSec = sections.find(s => s.id === selectedSectionId);
    const currentLetter = (activeSec?.letter || (activeSec?.id ? activeSec.id.match(/^([A-Za-z]+)/)?.[1] : allLetters[0]) || allLetters[0]).toUpperCase();

    return {
      letters: allLetters,
      sectionsByLetter: map,
      activeLetter: allLetters.includes(currentLetter) ? currentLetter : allLetters[0]
    };
  }, [sections, selectedSectionId]);

  const activeLetterSections = sectionsByLetter[activeLetter] || [];

  const handleSelectLetter = (letter) => {
    if (letter === activeLetter) return;
    const targetSections = sectionsByLetter[letter];
    if (targetSections && targetSections.length > 0) {
      onSelectSection(targetSections[0].id);
    }
  };

  // If only 1 letter group exists, show a single clean row of section chips
  if (letters.length <= 1) {
    return (
      <div
        data-testid="section-picker-single-level"
        className={`flex items-center bg-white/[0.04] p-0.5 rounded-full border border-white/[0.08] overflow-x-auto no-scrollbar ${className}`}
      >
        {sections.map((sec) => {
          const isSelected = sec.id === selectedSectionId;
          return (
            <button
              key={sec.id}
              type="button"
              data-testid={`section-chip-${sec.id}`}
              onClick={() => onSelectSection(sec.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition shrink-0 ${
                isSelected
                  ? 'bg-gradient-to-r from-[#ff2f3a] to-[#ff6b4a] text-white shadow-[0_0_12px_rgba(255,47,58,0.35)]'
                  : 'text-[#9c9c9d] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {sec.id}
            </button>
          );
        })}
      </div>
    );
  }

  // Two-level picker: Letter Tabs (Level 1) + Section Chips (Level 2)
  return (
    <div
      data-testid="section-picker-two-level"
      className={`flex items-center gap-1.5 ${className}`}
    >
      {/* Level 1: Letter Tabs */}
      <div className="flex items-center bg-white/[0.04] p-0.5 rounded-full border border-white/[0.08] shrink-0">
        {letters.map((letter) => {
          const isActive = letter === activeLetter;
          return (
            <button
              key={letter}
              type="button"
              data-testid={`letter-tab-${letter}`}
              onClick={() => handleSelectLetter(letter)}
              className={`px-2.5 py-0.5 text-xs font-semibold rounded-full transition ${
                isActive
                  ? 'bg-[#ff2f3a]/20 text-white border border-[#ff2f3a]/40 shadow-[0_0_10px_rgba(255,47,58,0.25)]'
                  : 'text-[#9c9c9d] hover:text-white hover:bg-white/[0.04] border border-transparent'
              }`}
              title={`Switch to practical group letter ${letter}`}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {/* Level 2: Section Chips for the active letter */}
      <div className="flex items-center bg-white/[0.04] p-0.5 rounded-full border border-white/[0.08] overflow-x-auto no-scrollbar shrink-0">
        {activeLetterSections.map((sec) => {
          const isSelected = sec.id === selectedSectionId;
          return (
            <button
              key={sec.id}
              type="button"
              data-testid={`section-chip-${sec.id}`}
              onClick={() => onSelectSection(sec.id)}
              className={`px-2.5 py-0.5 text-xs font-medium rounded-full transition ${
                isSelected
                  ? 'bg-gradient-to-r from-[#ff2f3a] to-[#ff6b4a] text-white shadow-[0_0_12px_rgba(255,47,58,0.35)]'
                  : 'text-[#9c9c9d] hover:text-white hover:bg-white/[0.04]'
              }`}
              title={`${sec.label || 'Section ' + sec.id} (Practical Group ${sec.practicalGroup})`}
            >
              {sec.id}
            </button>
          );
        })}
      </div>
    </div>
  );
}
