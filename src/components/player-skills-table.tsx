import { formatXp, type HiscoreSkill } from "@/lib/hiscores";
import { skillSpriteUrl } from "@/lib/sprites";

export function PlayerSkillsTable({
  displayName,
  skills
}: {
  displayName: string;
  skills: HiscoreSkill[];
}) {
  return (
    <section className="mt-10" data-account-home-board="true">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
        Account
      </h2>
      <div className="scape-table-wrap">
        <table className="scape-table" aria-label={`${displayName}'s skills with level, XP and rank`}>
          <thead>
            <tr>
              <th scope="col">Skill</th>
              <th scope="col" data-num>Level</th>
              <th scope="col" data-num>XP</th>
              <th scope="col" data-num>Rank</th>
            </tr>
          </thead>
          <tbody>
            {skills.filter((skill) => skill.name !== "Overall").map((skill) => (
              <SkillTableRow key={skill.id} skill={skill} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="scape-table-note">
        From the official Hiscores. Quests, diaries and worn gear are not visible there.
      </p>
    </section>
  );
}

function SkillTableRow({ skill }: { skill: HiscoreSkill }) {
  const level = skill.level > 0 ? skill.level : 1;
  const spriteUrl = skillSpriteUrl(skill.name);
  return (
    <tr>
      <th scope="row" className="whitespace-nowrap">
        <span className="flex items-center gap-2">
          {spriteUrl && (
            <img
              src={spriteUrl}
              alt=""
              width={14}
              height={14}
              className="pixelated shrink-0"
              style={{ imageRendering: "pixelated" }}
            />
          )}
          {skill.name}
        </span>
      </th>
      <td data-num style={level === 99 ? { color: "var(--color-gold)" } : undefined}>{level}</td>
      <td data-num>{skill.xp > 0 ? formatXp(skill.xp) : "—"}</td>
      <td data-num>{skill.rank > 0 ? `#${skill.rank.toLocaleString()}` : "—"}</td>
    </tr>
  );
}
