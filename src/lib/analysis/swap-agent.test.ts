import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { presetById } from "../audience/audience";
import type { QlooClient } from "../qloo/client";
import { runSwapAgent, WRAP_UP } from "./swap-agent";
import type { SwapContext } from "./swap-tools";

type Block = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown };
interface Sent {
  messages: { role: string; content: string | { type: string; content?: string }[] }[];
}

// A model that gives these replies in turn, and keeps what the agent sent it.
function scripted(replies: Block[][]) {
  const sent: Sent[] = [];
  const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    const content = replies[sent.length - 1];
    if (!content) throw new Error("The agent asked for more turns than the script has.");
    const message = {
      id: `msg_${sent.length}`,
      type: "message",
      role: "assistant",
      model: "test",
      content,
      stop_reason: content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    };
    return new Response(JSON.stringify(message), { headers: { "content-type": "application/json" } });
  };
  return { client: new Anthropic({ apiKey: "test", baseURL: "http://model.test", fetch, maxRetries: 0 }), sent };
}

// Fails any Qloo call, so a test can tell whether a search ran.
const qloo = new Proxy({} as QlooClient, {
  get: () => () => {
    throw new Error("Qloo was called");
  },
});

const ctx = (): SwapContext => ({
  original: {
    id: "TUMS",
    name: "Tums",
    entity_name: "Tums",
    type: "urn:entity:brand",
    kind: "brand",
    role: "an antacid that signals middle age",
    weight: "punchline",
    quotes: ["Tums"],
    line: "That's two tired people splitting an appetizer and a bottle of Tums.",
    verdict: "dead",
    reasons: [],
  },
  audience: { label: "College crowd", ageMix: presetById("college")!.ageMix, cities: [] },
  others: [],
  checked: {},
});

const lastToolResult = (request: Sent) => {
  const content = request.messages.at(-1)!.content;
  return typeof content === "string" ? content : content.find((b) => b.type === "tool_result")!.content!;
};

const turns = (first: Block): Block[][] => [
  [first],
  [{ type: "tool_use", id: "t2", name: "submit_swaps", input: { swaps: [], note: "Nothing checked beats it." } }],
  [{ type: "text", text: "Submitted." }],
];

describe("runSwapAgent", () => {
  it("stops searching and asks for a submission once it's time to wrap up", async () => {
    const { client, sent } = scripted(turns({ type: "tool_use", id: "t1", name: "find_tags", input: { query: "antacid" } }));
    const result = await runSwapAgent(client, qloo, ctx(), { wrapUpAt: Date.now() - 1 });
    expect(lastToolResult(sent[1])).toBe(`Not run. ${WRAP_UP}`);
    expect(result).toEqual({ swaps: [], note: "Nothing checked beats it." });
  });

  it("asks for a submission a few turns before the turn limit", async () => {
    const search = (i: number): Block[] => [{ type: "tool_use", id: `t${i}`, name: "find_tags", input: { query: "antacid" } }];
    const { client, sent } = scripted([
      ...Array.from({ length: 10 }, (_, i) => search(i)),
      [{ type: "tool_use", id: "s", name: "submit_swaps", input: { swaps: [], note: "Out of turns." } }],
      [{ type: "text", text: "Submitted." }],
    ]);
    const result = await runSwapAgent(client, qloo, ctx());
    expect(lastToolResult(sent[9])).toMatch(/^Error: Qloo was called/);
    expect(lastToolResult(sent[10])).toBe(`Not run. ${WRAP_UP}`);
    expect(result.note).toBe("Out of turns.");
  });

  it("searches as usual before then", async () => {
    const { client, sent } = scripted(turns({ type: "tool_use", id: "t1", name: "find_tags", input: { query: "antacid" } }));
    await runSwapAgent(client, qloo, ctx(), { wrapUpAt: Date.now() + 60_000 });
    expect(lastToolResult(sent[1])).toMatch(/^Error: Qloo was called/);
    expect(lastToolResult(sent[1])).not.toContain(WRAP_UP);
  });
});
