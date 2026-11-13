export const HELP_EN = {
  team_workflow: {
    title: "3-Step AI Timetable Workflow",
    desc: "Step 1: Copy Prompt 1, paste it into your AI chat (ChatGPT, Claude) alongside your faculty timetable PDF/image, and fill in the module box at the top.\nStep 2: Check the formatted plain text against the PDF. Then Copy Prompt 2, paste the formatted text into the AI, and receive the complete JSON file.\nStep 3: Click 'Import JSON' and paste the code block directly into Medscope Studio."
  },
  section: {
    title: "Section & Group Model",
    desc: "Sections are numbered globally 1..N across groups (e.g. Group A: 1-3, Group B: 4-6, Group C: 7-9). Each section receives its own tailored weekly timetable page containing only the sessions relevant to them."
  },
  week: {
    title: "Week",
    desc: "The calendar cycle number of the university term. Each week maps to one printed page per section."
  },
  scope: {
    title: "Scope Targeting",
    desc: "Defines which student sections attend this session. Supported scopes:\n• Everyone: {\"all\": true} — all module sections attend together.\n• Letter Group: {\"letter\": \"A\"} — all sections in Group A (e.g. 1, 2, 3).\n• Practical Groups: {\"practicalGroups\": [1, 2]} — lab cohorts 1 and 2.\n• Specific Sections: {\"sections\": [\"1\", \"4\"]} — targets specific individual sections."
  },
  status: {
    title: "Session Status",
    desc: "• Normal: in-person session with designated start, end times and room.\n• Recorded: asynchronous online lecture; renders 'Recorded' in Place with a dash in Time, sorting last in the day.\n• Leave: public holiday or study leave; spans across Topic and Place columns displaying the holiday title."
  },
  topics: {
    title: "Topics",
    desc: "The academic topic or lecture titles. Enter one topic per line or separate with pipes (e.g. 'L1: Epithelium Structure'). Lines render sequentially in the Topic column."
  },
  replace_vs_merge: {
    title: "Import Modes",
    desc: "• Merge sessions: keeps existing sessions and updates or adds new sessions safely.\n• Replace weeks: replaces matching weeks and adds new weeks.\n• Replace project: replaces the entire timetable project with the imported file."
  },
  export_preflight: {
    title: "Export Audit Check",
    desc: "Before generating PDFs, the Export dialog automatically checks for critical schedule collisions (time overlaps, missing times or places, and weekday dates). If everything is clean, it reports 'Everything looks fine'. You can always proceed to export."
  },
  export_scope: {
    title: "Export Scope",
    desc: "• Current: exports only the currently viewed section and week.\n• Section (All Weeks): exports all term weeks for the selected section.\n• Week (All Sections): exports all university sections for the selected week.\n• Complete All: exports every week for every section in the module."
  },
  pdf_vs_zip: {
    title: "Multi-Page PDF vs ZIP Archive",
    desc: "• Single Multi-Page PDF: binds all generated weekly pages consecutively into one consolidated PDF file.\n• ZIP of Separate PDFs: bundles individual PDF files for each page into a ZIP archive."
  },
  png: {
    title: "PNG Image Export",
    desc: "Renders the timetable pages as lossless high-resolution PNG images, ideal for digital sharing, Telegram, or social media."
  },
  resolution_presets: {
    title: "Resolution Presets",
    desc: "• 1.0x (Standard Web): 1414×2000 px, ~96 DPI. Fast rendering for quick digital previews.\n• 1.5x (High Resolution): 2121×3000 px, 250+ DPI. Optimal balance of clarity and file size.\n• 2.0x (Ultra Print): 2828×4000 px, 300+ DPI. Razor-sharp vector clarity for professional commercial printing."
  },
  page_size: {
    title: "Page Size Presets",
    desc: "Standard A4 portrait (210×297 mm, 1414×2000 px ratio), A3 poster, or custom pixel dimensions defined in Theme settings."
  },
  filename_placeholders: {
    title: "Filename Pattern Placeholders",
    desc: "Customize automatic export filenames using dynamic placeholders:\n• {module}: Module name (e.g. GIT)\n• {term}: Term label (e.g. 1st_Term)\n• {group}: Group letter (e.g. C)\n• {section}: Section number (e.g. 8)\n• {week}: Week number (e.g. 3)\n• {date}: Today's ISO date (YYYY-MM-DD)"
  },
  time_format: {
    title: "Time Format",
    desc: "Controls how time ranges are formatted inside table cells:\n• Compact: '(8-9:30)'\n• Padded: '(08:00-09:30)'\n• 12h AM/PM: '(8:00 AM - 9:30 AM)'"
  },
  row_weights: {
    title: "Row Weights & Height Rules",
    desc: "Calculates day row heights based on session density. Days with multiple sessions expand proportionately. OFF and single-session days scale with configurable base weights."
  },
  manual_row_height: {
    title: "Manual Row Height Overrides",
    desc: "Allows overriding the calculated height of any specific day (e.g. setting 'Sat' to 140px) directly in the Theme Geometry panel."
  },
  theme_presets: {
    title: "Theme Presets",
    desc: "Save and load custom visual identities, color palettes, typography, and table geometries. Themes can be exported and imported as JSON."
  },
  undo_redo: {
    title: "Undo / Redo",
    desc: "Quickly revert or reapply changes to project data, styling, and imports. Use keyboard shortcuts Ctrl+Z (Undo) and Ctrl+Y / Ctrl+Shift+Z (Redo)."
  },
  print_mode: {
    title: "Browser Print Mode Steps",
    desc: "For native vector printing directly from Google Chrome or Edge:\n1. Open browser print dialog (Ctrl+P or Print Mode in More menu).\n2. Set Destination: 'Save as PDF'.\n3. Set Margins: 'None'.\n4. Set Scale: '100%'.\n5. Check 'Background graphics' ON.\nAll weeks for the active section will print cleanly, one A4 page per week without clipping."
  },
  show_off_days: {
    title: "Show OFF Days",
    desc: "Controls whether days with no sessions are displayed in the timetable. When turned OFF, unscheduled days are hidden and the remaining active days expand to fill the table height. If all days in a week are OFF, one placeholder row is kept so the table is never empty."
  },
  browser_storage_note: {
    title: "Browser Storage & Privacy",
    desc: "All timetable data and themes live 100% inside your local browser storage (localStorage). No data is ever sent to external servers. Use 'Export JSON' to back up or share your projects."
  }
};
