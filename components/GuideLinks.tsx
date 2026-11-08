import Link from "next/link";
import { Arrow, SkillIcon } from "@/components/Icons";
import { localePath, translate, type Key, type Lang } from "@/lib/dict";
import { GUIDE_SKILLS } from "@/lib/guides";

export default function GuideLinks({ lang, exclude }: { lang: Lang; exclude?: string }) {
  const t = (k: Key, vars?: Record<string, string | number>) => translate(lang, k, vars);
  const links = [
    ...GUIDE_SKILLS.map((s) => ({ key: s, path: `/${s}/`, label: t("guide.skillCard", { skill: t(`skill.${s}` as Key) }), skill: s })),
    { key: "scores", path: "/scores/", label: t("guide.scores"), skill: undefined },
    { key: "faq", path: "/faq/", label: t("guide.faq"), skill: undefined },
  ].filter((l) => l.key !== exclude);
  return (
    <div className="grid picks guide-links">
      {links.map((l) => (
        <Link key={l.key} href={localePath(lang, l.path)} className="card pick-card">
          <span className="row tight">
            {l.skill && <span className={`icon-tile skill-${l.skill}`}><SkillIcon skill={l.skill} size={18} /></span>}
            <b>{l.label}</b>
          </span>
          <Arrow size={16} className="go" />
        </Link>
      ))}
    </div>
  );
}
