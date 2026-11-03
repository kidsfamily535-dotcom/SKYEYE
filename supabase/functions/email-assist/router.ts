import { createClient } from "npm:@supabase/supabase-js@2";

export const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

export type Msg = { role: "system" | "user" | "assistant"; content: string };
export type RouterInput = {
  task?: string;
  messages: Msg[];
  system?: string;
  prefer?: "long" | "fast";
  json_mode?: boolean;
  company_id?: string | null;
  max_tokens?: number;
  temperature?: number;
  timeout_ms?: number;
};
export type Attempt = {
  provider: string;
  model: string;
  status: "ok" | "error" | "skipped";
  http_status?: number;
  latency_ms?: number;
  error?: string;
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Backend-only: caller must present the service role key.
export function isService(req: Request) {
  const h = req.headers.get("Authorization") ?? "";
  const k = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return k.length > 0 && h === `Bearer ${k}`;
}

export async function callLLM(input: RouterInput) {
  const task = input.task ?? "generic";
  const prefer = input.prefer ?? "long";
  const { data: all, error: pe } = await sb
    .from("llm_providers")
    .select("*")
    .eq("enabled", true);
  if (pe) throw new Error("providers_load_failed: " + pe.message);
  let providers = all ?? [];

  // ---- data_class guard (fail-closed) ----
  // Unknown or missing company => treated as REAL data.
  let dataClass: "test" | "real" = "real";
  if (input.company_id) {
    const { data: c } = await sb
      .from("companies")
      .select("data_class")
      .eq("id", input.company_id)
      .maybeSingle();
    if (c?.data_class === "test") dataClass = "test";
  }
  if (dataClass === "real") {
    providers = providers.filter((p) => p.approved_for_real === true);
    if (input.company_id) {
      const { data: al } = await sb
        .from("company_llm_providers")
        .select("provider_id")
        .eq("company_id", input.company_id);
      if (al && al.length > 0) {
        const ids = new Set(al.map((r) => r.provider_id));
        providers = providers.filter((p) => ids.has(p.id));
      }
    }
    if (providers.length === 0) {
      const err = "blocked: real data and no approved provider";
      await sb.from("llm_calls").insert({
        company_id: input.company_id ?? null,
        task,
        status: "skipped",
        error: err,
      });
      return {
        result: null,
        blocked: true,
        attempts: [{ provider: "-", model: "-", status: "skipped" as const, error: err }] as Attempt[],
      };
    }
  }

  const ordered = providers.sort((a, b) => {
    const ap = a.purpose === prefer ? 0 : 1;
    const bp = b.purpose === prefer ? 0 : 1;
    return ap - bp || a.priority - b.priority;
  });

  const messages = input.system
    ? [{ role: "system", content: input.system }, ...input.messages]
    : input.messages;

  const attempts: Attempt[] = [];
  const logs: Record<string, unknown>[] = [];
  let result:
    | { text: string; provider: string; model: string; usage: unknown }
    | null = null;

  for (const p of ordered) {
    const key = Deno.env.get(p.api_key_env);
    if (!key) {
      attempts.push({
        provider: p.name,
        model: p.model,
        status: "skipped",
        error: `missing secret ${p.api_key_env}`,
      });
      continue;
    }
    const t0 = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), input.timeout_ms ?? 40000);
    const fail = (error: string, http_status?: number) => {
      const latency_ms = Date.now() - t0;
      attempts.push({ provider: p.name, model: p.model, status: "error", http_status, latency_ms, error });
      logs.push({
        company_id: input.company_id ?? null,
        task,
        provider: p.name,
        model: p.model,
        status: "error",
        http_status: http_status ?? null,
        latency_ms,
        error,
      });
    };
    try {
      const body: Record<string, unknown> = {
        model: p.model,
        messages,
        max_tokens: input.max_tokens ?? 1500,
        temperature: input.temperature ?? 0.2,
      };
      if (input.json_mode && p.supports_json) {
        body.response_format = { type: "json_object" };
      }
      const r = await fetch(`${String(p.base_url).replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const raw = await r.text();
      if (!r.ok) {
        fail(raw.slice(0, 300), r.status);
        continue;
      }
      let j: any;
      try {
        j = JSON.parse(raw);
      } catch {
        fail("invalid json from provider", r.status);
        continue;
      }
      let text = String(j?.choices?.[0]?.message?.content ?? "");
      text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      if (!text) {
        fail("empty response", r.status);
        continue;
      }
      const latency_ms = Date.now() - t0;
      attempts.push({ provider: p.name, model: p.model, status: "ok", http_status: r.status, latency_ms });
      logs.push({
        company_id: input.company_id ?? null,
        task,
        provider: p.name,
        model: p.model,
        status: "ok",
        http_status: r.status,
        latency_ms,
        prompt_tokens: j?.usage?.prompt_tokens ?? null,
        completion_tokens: j?.usage?.completion_tokens ?? null,
      });
      result = { text, provider: p.name, model: p.model, usage: j?.usage ?? null };
      break;
    } catch (e) {
      fail(e instanceof Error ? (e.name === "AbortError" ? "timeout" : e.message) : String(e));
    } finally {
      clearTimeout(timer);
    }
  }

  if (logs.length) {
    const { error } = await sb.from("llm_calls").insert(logs);
    if (error) console.error("llm_calls insert failed:", error.message);
  }
  return { result, blocked: false, attempts };
}
