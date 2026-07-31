// jsonRes: the one JSON response builder (promoted from set-view-scale, which
// invented it while every other function hand-rolled
// `new Response(JSON.stringify(...), { ...corsHeaders, 'Content-Type': ... })`
// at every exit — 60+ copies tree-wide before this).
import { corsHeaders } from './cors.ts'

export function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
