// Shared "bank filler" sentinel. Used by layout builders to mark empty slots
// in a set / family template (Bandos kolom met ontbrekende helm → filler
// slot waar de helm zou staan). The render layer detects this id and shows
// the OSRS Bank filler sprite instead of treating it as a real item.

export const BANK_FILLER_ID = 20594;
