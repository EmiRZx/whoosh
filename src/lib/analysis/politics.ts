// Whoosh doesn't measure political taste. The extraction prompt marks
// politicians as unmeasured, and this catches the ones a model misses (a
// former Secretary of State, a president from history) from Qloo's own tags,
// so they are neither measured nor offered as swaps.
import type { QlooEntity } from "../qloo/api";

// Tags that only someone known for public office gets.
const OFFICE =
  /presidents? of the united states|united states senators|members of the united states (house|congress)|secretar(y|ies) of state|cabinet members|members of the cabinet|first ladies|governors of|mayors of|prime ministers|heads of state|members of parliament|candidates in the .*(presidential|gubernatorial|senate|congressional) election/i;

// "Politician" alone also marks actors who once held office; they stay.
const POLITICIAN = /\bpoliticians?\b/i;
const OTHER_CAREER = /\b(actor|actress|comedian|musician|singer|rapper|athlete|player|television presenter|talk show|host|author|novelist|journalist|businessperson|entrepreneur|film director|producer)s?\b/i;

export function isPolitical(entity: Pick<QlooEntity, "types" | "tags">): boolean {
  if (!entity.types.some((t) => t === "urn:entity:person")) return false;
  const tags = entity.tags.map((t) => t.name ?? "");
  if (tags.some((t) => OFFICE.test(t))) return true;
  return tags.some((t) => POLITICIAN.test(t)) && !tags.some((t) => OTHER_CAREER.test(t));
}
