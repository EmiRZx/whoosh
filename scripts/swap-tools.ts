// Runs one swap-agent tool against a saved context, so the agent's tools can
// be exercised (and the agent simulated) without a model API. check() results
// are saved back into the context, as they are within a live agent run.
// Usage: npx tsx --env-file=.env.local scripts/swap-tools.ts <context.json> <tool> '<json input>'
// Tools: find_candidates, lookup, find_tags, check, submit_swaps
import { readFile, writeFile } from "node:fs/promises";
import { getQlooClient } from "../src/lib/qloo/server";
import {
  check,
  CheckInput,
  findCandidates,
  FindCandidatesInput,
  FindTagsInput,
  findTagIds,
  lookup,
  LookupInput,
  SubmitInput,
  validateSubmission,
  type SwapContext,
} from "../src/lib/analysis/swap-tools";

async function main() {
  const [ctxPath, tool, raw] = process.argv.slice(2);
  const ctx: SwapContext = JSON.parse(await readFile(ctxPath, "utf8"));
  const qloo = getQlooClient();
  if (!qloo) throw new Error("QLOO_API_KEY is not set");
  const input = JSON.parse(raw ?? "{}");

  let result: unknown;
  switch (tool) {
    case "find_candidates":
      result = await findCandidates(qloo, ctx, FindCandidatesInput.parse(input));
      break;
    case "lookup":
      result = await lookup(qloo, LookupInput.parse(input));
      break;
    case "find_tags":
      result = await findTagIds(qloo, FindTagsInput.parse(input));
      break;
    case "check":
      result = await check(qloo, ctx, CheckInput.parse(input));
      await writeFile(ctxPath, JSON.stringify(ctx, null, 2));
      break;
    case "submit_swaps": {
      const submission = SubmitInput.parse(input);
      const problems = validateSubmission(ctx, submission);
      if (problems.length) {
        result = `Not accepted:\n- ${problems.join("\n- ")}`;
      } else {
        await writeFile(ctxPath.replace(/\.json$/, ".result.json"), JSON.stringify(submission, null, 2));
        result = "Accepted.";
      }
      break;
    }
    default:
      throw new Error(`Unknown tool ${tool}`);
  }
  console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.log(`Error: ${err.message}`);
  process.exitCode = 1;
});
