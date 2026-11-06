import GIT_SCHEDULE from './samples/GIT_all_sections.json' with { type: 'json' };

// Default fixture is the real GIT schedule (module "Gastrointestinal Tract", 12 sections A1-D3, 7 weeks, 317 sessions)
export const DEFAULT_SCHEDULE = GIT_SCHEDULE;
export { GIT_SCHEDULE };

// Default Theme matching the 1414x2000 reference designs (themeVersion: 3)
export const DEFAULT_THEME = {
  themeVersion: 3,
  name: "Medscope Official 1414x2000",

  // Page Geometry
  geometry: {
    pageSize: "A4", // "A4" | "A3" | "Custom"
    canvasWidth: 1414,
    canvasHeight: 2000,
    tableX: 48,
    tableY: 240,
    tableWidth: 1314,
    tableHeight: 1705,
    headerRowHeight: 92,
    tableBorderWidth: 4,
    tableBorderColor: "#0a2050",
    tableBorderRadius: 8,
    tableInnerDividerWidth: 2,
    tableInnerDividerColor: "rgba(255, 255, 255, 0.6)",
    columnWidths: {
      day: 202,
      topic: 632,
      place: 246,
      time: 234
    },
    rowWeightRules: {
      offWeight: 1.25,
      minSessionWeight: 1.25
    },
    manualRowHeightOverrides: {} // e.g. { "Sat": 140 }
  },

  // Header Layout
  headerLayout: {
    weekLabel: { x: 48, y: 16, width: 320, height: 96, visible: true },
    termLabel: { x: 52, y: 112, width: 320, height: 40, visible: true },
    moduleTitle: { x: 320, y: 16, width: 730, height: 110, visible: true },
    sectionLabel: { x: 320, y: 128, width: 730, height: 90, visible: true },
    qrCode: { x: 1048, y: 20, width: 140, height: 140, visible: true },
    logo: { x: 1200, y: 20, width: 192, height: 165, visible: true }
  },

  // Text Styles per Role
  textStyles: {
    weekLabel: {
      fontFamily: "Grand Hotel",
      size: 96,
      weight: 400,
      color: "#e0c070",
      shadow: "0 0 12px rgba(224, 192, 112, 0.4)",
      underline: false,
      letterSpacing: "0px"
    },
    termLabel: {
      fontFamily: "Poppins",
      size: 41,
      weight: 700,
      color: "#ffffff",
      shadow: "0 2px 4px rgba(0, 0, 0, 0.8)",
      underline: false,
      letterSpacing: "0px"
    },
    moduleTitle: {
      fontFamily: "Poppins",
      size: 108,
      weight: 800,
      color: "#001238",
      shadow: "0 0 14px #ffffff, 0 0 24px rgba(255, 255, 255, 0.9), 0 0 34px rgba(255, 255, 255, 0.6)",
      underline: false,
      letterSpacing: "0.01em"
    },
    sectionLabel: {
      fontFamily: "Grand Hotel",
      size: 84,
      weight: 400,
      color: "#e0c070",
      shadow: "0 0 10px rgba(224, 192, 112, 0.5)",
      underline: false,
      letterSpacing: "0px"
    },
    headerLabels: {
      fontFamily: "Lilita One",
      size: 70,
      weight: 400,
      color: "#001848",
      shadow: "none",
      underline: false,
      letterSpacing: "0px"
    },
    dayText: {
      fontFamily: "Lilita One",
      size: 38,
      weight: 400,
      color: "#001848",
      shadow: "2px 3px 0 rgba(0, 10, 40, 0.5)",
      underline: false,
      letterSpacing: "0px"
    },
    dayDate: {
      fontFamily: "Lilita One",
      size: 30,
      weight: 400,
      color: "#001848",
      shadow: "2px 3px 0 rgba(0, 10, 40, 0.5)",
      underline: false,
      letterSpacing: "0px",
      visible: true
    },
    sessionType: {
      fontFamily: "Fredoka",
      size: 41,
      weight: 600,
      color: "#d6c070",
      shadow: "none",
      underline: true,
      letterSpacing: "0px"
    },
    sessionSubject: {
      fontFamily: "Fredoka",
      size: 41,
      weight: 600,
      color: "#c0f080",
      shadow: "2px 2px 0 rgba(0, 10, 40, 0.6)",
      underline: false,
      letterSpacing: "0px"
    },
    topicLine: {
      fontFamily: "Arimo",
      size: 26,
      weight: 700,
      color: "#001848",
      shadow: "2px 3px 0 rgba(0, 10, 40, 0.5)",
      underline: true,
      letterSpacing: "0px"
    },
    placeText: {
      fontFamily: "Fredoka",
      size: 53,
      weight: 600,
      color: "#001848",
      shadow: "2px 3px 0 rgba(0, 10, 40, 0.5)",
      underline: false,
      letterSpacing: "0px"
    },
    timeText: {
      fontFamily: "Lilita One",
      size: 46,
      weight: 400,
      color: "#001848",
      shadow: "2px 3px 0 rgba(0, 10, 40, 0.5)",
      underline: false,
      letterSpacing: "0px"
    },
    offText: {
      fontFamily: "Lilita One",
      size: 62,
      weight: 400,
      color: "#001848",
      shadow: "2px 3px 0 rgba(0, 10, 40, 0.5)",
      underline: false,
      letterSpacing: "0.04em"
    },
    recordedText: {
      fontFamily: "Fredoka",
      size: 53,
      weight: 600,
      color: "#001848",
      shadow: "2px 3px 0 rgba(0, 10, 40, 0.5)",
      underline: false,
      letterSpacing: "0px"
    },
    leaveText: {
      fontFamily: "Lilita One",
      size: 54,
      weight: 400,
      color: "#90f0e0",
      shadow: "2px 3px 0 rgba(0, 10, 40, 0.5)",
      underline: false,
      letterSpacing: "0px"
    },
    footerText: {
      fontFamily: "Grand Hotel",
      size: 48,
      weight: 400,
      color: "#ffffff",
      shadow: "0 0 10px rgba(255, 255, 255, 0.7), 0 2px 4px rgba(0, 0, 0, 0.8)",
      underline: false,
      letterSpacing: "0px"
    }
  },

  // Colors & Fills
  fills: {
    tableHeaderBg: "#dfc274",
    dayCellBg: "#acb7c2",
    contentCellBg: "rgba(154, 172, 196, 0.83)"
  },

  // Content Formats & Placeholders
  contentFormats: {
    timeFormat: "compact", // "compact" | "padded" | "12h_ampm"
    dayNameFormat: "full", // "full" | "short"
    dateFormat: "d/m", // "d/m" | "dd/mm" | "d MMM"
    sessionTypeLabels: {
      prac: "Prac {n}",
      lec: "Lec {n}",
      tut: "Tut.{n}"
    },
    titleGlyphs: {
      prefix: "=",
      separator: ">",
      prefixColor: "#001848",
      separatorColor: "#000000"
    },
    specialTexts: {
      off: "OFF",
      recordedPlace: "Recorded",
      recordedTime: "—",
      leaveDefault: "Study leave"
    },
    templates: {
      sectionLabel: "Group ({letter}) Section {number}",
      footerLeft: "Dr.Omar Medhat",
      footerRight: "Medscope Alex Medicine"
    }
  },

  // Background
  background: {
    type: "image", // "image" | "color"
    image: "./assets/bg.png",
    color: "#091228",
    fitMode: "100% 100%", // "100% 100%" | "cover" | "contain"
    position: "center",
    brightness: 1.0,
    darkenOverlay: 0.0
  },

  // Assets (Logo & QR & Custom Fonts)
  assets: {
    logoImage: "./assets/logo.png",
    showLogo: true,
    qrType: "image",
    qrImage: "./assets/qr.png",
    qrUrl: "https://t.me/medscope",
    showQr: true,
    customFonts: []
  },

  // Footer & Misc
  footer: {
    showPageNumber: true
  },

  // Legacy flat fields for backward compatibility
  canvasWidth: 1414,
  canvasHeight: 2000,
  pageSize: "A4",
  tableHeaderBg: "#dfc274",
  tableHeaderTextColor: "#001848",
  tableBorderColor: "#0a2050",
  tableBorderWidth: 4,
  tableInnerDividerColor: "rgba(255, 255, 255, 0.6)",
  tableInnerDividerWidth: 2,
  dayCellBg: "#acb7c2",
  contentCellBg: "rgba(154, 172, 196, 0.83)",
  weekFont: "Grand Hotel",
  termFont: "Poppins",
  titleFont: "Poppins",
  titleColor: "#001238",
  titleGlow: "0 0 14px #ffffff, 0 0 24px rgba(255, 255, 255, 0.9), 0 0 34px rgba(255, 255, 255, 0.6)",
  sectionFont: "Grand Hotel",
  tableHeaderFont: "Lilita One",
  tableFont: "Lilita One",
  footerFont: "Grand Hotel",
  weekColor: "#e0c070",
  sectionColor: "#e0c070",
  typeLabelColor: "#d6c070",
  textColor: "#001848",
  textShadow: "2px 3px 0 rgba(0, 10, 40, 0.5)",
  leaveColor: "#90f0e0",
  bgImage: "./assets/bg.png",
  logoImage: "./assets/logo.png",
  showLogo: true,
  qrImage: "./assets/qr.png",
  showQr: true
};

export const GOOGLE_FONTS = [
  { label: "Grand Hotel (Calligraphic Script)", value: "Grand Hotel", type: "script" },
  { label: "Poppins (ExtraBold Sans)", value: "Poppins", type: "heading" },
  { label: "Lilita One (Heavy Rounded Display)", value: "Lilita One", type: "table" },
  { label: "Fredoka (Rounded Sans)", value: "Fredoka", type: "table" },
  { label: "Arimo (Clean Sans)", value: "Arimo", type: "table" },
  { label: "Baloo 2 (ExtraBold Rounded)", value: "Baloo 2", type: "table" },
  { label: "Dancing Script (Cursive Script)", value: "Dancing Script", type: "script" },
  { label: "Caveat (Handwritten Script)", value: "Caveat", type: "script" },
  { label: "Pacifico (Casual Script)", value: "Pacifico", type: "script" },
  { label: "Outfit (Geometric Sans)", value: "Outfit", type: "heading" },
  { label: "Montserrat (Classic Sans)", value: "Montserrat", type: "heading" },
  { label: "Inter (Neutral Sans)", value: "Inter", type: "sans" }
];
