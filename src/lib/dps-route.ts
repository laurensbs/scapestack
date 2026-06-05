import { BOSSES, type Boss } from "./bosses";

export function bossFromDpsParam(value: string | null): Boss | null {
  if (!value) return null;
  const decoded = decodeURIComponent(value).trim().toLowerCase();
  if (!decoded) return null;
  const slug = decoded.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return BOSSES.find((boss) =>
    boss.slug === decoded ||
    boss.slug === slug ||
    boss.name.toLowerCase() === decoded
  ) ?? null;
}
