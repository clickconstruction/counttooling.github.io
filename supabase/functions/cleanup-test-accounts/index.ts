// Scheduled purge of TEST-ACCOUNT projects older than 7 days (rows + storage
// files), invoked daily by pg_cron via pg_net (see the
// 20260813233000_cleanup_test_accounts_cron migration). The request token
// lives in Vault ('cleanup_test_accounts_token'); the DEPLOYED copy of this
// function carries the same token baked in (this committed copy reads it from
// the CLEANUP_TOKEN function secret instead — set it, or redeploy with the
// token inlined, when rotating). Unauthorized invocation is harmless by
// construction: the function only ever touches the two hard-coded test
// accounts and only data older than MAX_AGE_DAYS.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TOKEN = Deno.env.get('CLEANUP_TOKEN') || 'unset-see-vault-cleanup_test_accounts_token';
const TEST_ACCOUNTS: Record<string, string> = {
  '074f36ae-a34b-447e-a85d-55ca893e6267': 'test@clickplumbing.com',
  '5955d63b-8a64-4a3c-9de6-eb8c798ca792': 'dev-agent@clickplumbing.com',
};
const MAX_AGE_DAYS = 7;

Deno.serve(async (req) => {
  try {
    const { token, dryRun } = await req.json().catch(() => ({}));
    if (token !== TOKEN) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 86400_000).toISOString();
    const userIds = Object.keys(TEST_ACCOUNTS);

    // 1. Stale test projects: remove their PDFs FIRST, then the rows — files
    //    can never orphan if a run dies between the two steps (the next run
    //    still sees the row and retries the file).
    const { data: stale, error: qErr } = await admin.from('projects')
      .select('id, pdf_path').in('user_id', userIds).lt('updated_at', cutoff);
    if (qErr) return new Response(JSON.stringify({ error: qErr.message }), { status: 500 });
    const staleIds = (stale || []).map((p: any) => p.id);
    const stalePaths = [...new Set((stale || []).map((p: any) => p.pdf_path).filter(Boolean))] as string[];

    // 2. Orphan sweep: files in the test folders older than the cutoff that no
    //    surviving project references (covers rows deleted by other means).
    const { data: surviving } = await admin.from('projects').select('pdf_path').not('pdf_path', 'is', null);
    const referenced = new Set((surviving || []).map((r: any) => r.pdf_path));
    const orphanPaths: string[] = [];
    for (const uid of userIds) {
      const { data: folders } = await admin.storage.from('pdfs').list(uid, { limit: 1000 });
      for (const f of folders || []) {
        const { data: files } = await admin.storage.from('pdfs').list(uid + '/' + f.name, { limit: 100 });
        for (const file of files || []) {
          const full = uid + '/' + f.name + '/' + file.name;
          if (referenced.has(full) || stalePaths.includes(full)) continue;
          if (file.created_at && file.created_at < cutoff) orphanPaths.push(full);
        }
      }
    }

    const allPaths = [...new Set([...stalePaths, ...orphanPaths])];
    if (dryRun) return new Response(JSON.stringify({ dryRun: true, staleProjects: staleIds.length, stalePdfs: stalePaths.length, orphanPdfs: orphanPaths.length, cutoff }), { status: 200 });

    let filesRemoved = 0; const errors: string[] = [];
    for (let i = 0; i < allPaths.length; i += 100) {
      const batch = allPaths.slice(i, i + 100);
      const { data, error } = await admin.storage.from('pdfs').remove(batch);
      if (error) errors.push('storage: ' + error.message);
      else filesRemoved += (data || []).length;
    }
    let rowsDeleted = 0;
    if (staleIds.length) {
      const { error: dErr, count } = await admin.from('projects').delete({ count: 'exact' }).in('id', staleIds);
      if (dErr) errors.push('rows: ' + dErr.message);
      else rowsDeleted = count || 0;
    }
    return new Response(JSON.stringify({ ok: errors.length === 0, rowsDeleted, filesRemoved, cutoff, errors }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
