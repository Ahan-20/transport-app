// Canonical class labels in school-display order: pre-school first, then
// numeric grades. New students must pick from this list (it's the only
// option in the StudentForm dropdown). Existing rows with legacy values
// like "K G" / "KG" / "prep" keep their value until someone edits them
// and saves a canonical pick — the form is tolerant, not destructive.
//
// IF you ever want to add a new class (e.g. 13, LKG split from KG, etc.)
// add it here and redeploy. No DB change is needed — class is a free-form
// TEXT column on students.
export const CANONICAL_CLASSES = [
  "P.G",
  "NUR",
  "PREP",
  "K.G.",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
] as const;

export type CanonicalClass = (typeof CANONICAL_CLASSES)[number];

export function isCanonicalClass(v: string | null | undefined): v is CanonicalClass {
  return !!v && (CANONICAL_CLASSES as readonly string[]).includes(v);
}
