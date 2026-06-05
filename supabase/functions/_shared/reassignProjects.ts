// Shared engine: move every project owned by `fromUserId` to `toUserId`, including the
// owner-scoped PDF storage objects. Used by `admin-delete-user` (delete-with-reassign)
// and `admin-reassign-projects` (standalone transfer).
//
// PDFs are stored at `{ownerId}/{projectId}/document.pdf` and storage RLS only lets a
// user read files under their own uid folder (migration 002_pdf_storage), so a true
// ownership transfer must MOVE the storage object as well as update projects.user_id —
// otherwise the new owner can't open the PDF.
//
// Ordering is load-bearing (there is no cross-system transaction): for each project we
// move storage FIRST, then update the DB row. A crash after the move leaves the file at
// the new path while pdf_path still points at the old one — temporarily unreadable, but
// a re-run self-heals (the idempotency probe below treats an already-moved file as
// success, and `.eq('user_id', fromUserId)` no longer selects already-updated rows).
// Any unrecoverable failure THROWS so callers abort without deleting anything.

// deno-lint-ignore no-explicit-any
export async function reassignProjects(adminClient: any, fromUserId: string, toUserId: string): Promise<{ reassigned: number; projectIds: string[] }> {
  const { data: projects, error: listErr } = await adminClient
    .from('projects')
    .select('id, pdf_path')
    .eq('user_id', fromUserId)
  if (listErr) throw new Error('Failed to list projects: ' + listErr.message)

  const movedIds: string[] = []
  for (const p of (projects ?? [])) {
    if (p.pdf_path) {
      const segs = String(p.pdf_path).split('/')
      segs[0] = toUserId // swap the owner folder, keep {projectId}/document.pdf
      const newPath = segs.join('/')
      if (newPath !== p.pdf_path) {
        const { error: moveErr } = await adminClient.storage.from('pdfs').move(p.pdf_path, newPath)
        if (moveErr) {
          // Idempotency: a prior partial run may have already moved this file.
          const folder = newPath.split('/').slice(0, -1).join('/')
          const fname = newPath.split('/').pop()
          const { data: existing } = await adminClient.storage.from('pdfs').list(folder, { search: fname })
          const alreadyThere = (existing ?? []).some((o: { name: string }) => o.name === fname)
          if (!alreadyThere) {
            throw new Error('Storage move failed for project ' + p.id + ': ' + moveErr.message)
          }
        }
      }
      const { error: upErr } = await adminClient
        .from('projects')
        .update({ user_id: toUserId, pdf_path: newPath })
        .eq('id', p.id)
      if (upErr) throw new Error('Failed to reassign project ' + p.id + ': ' + upErr.message)
    } else {
      const { error: upErr } = await adminClient
        .from('projects')
        .update({ user_id: toUserId })
        .eq('id', p.id)
      if (upErr) throw new Error('Failed to reassign project ' + p.id + ': ' + upErr.message)
    }
    movedIds.push(p.id)
  }

  if (movedIds.length > 0) {
    // Preserve inherited view links: reassign created_by, scoped to the moved projects
    // (links the user created on OTHER people's projects still die with the account).
    const { error: vlErr } = await adminClient
      .from('project_view_links')
      .update({ created_by: toUserId })
      .eq('created_by', fromUserId)
      .in('project_id', movedIds)
    if (vlErr) throw new Error('Failed to reassign view links: ' + vlErr.message)

    // Remove now-redundant share rows (the new owner was already a share recipient).
    const { error: shErr } = await adminClient
      .from('project_shares')
      .delete()
      .eq('user_id', toUserId)
      .in('project_id', movedIds)
    if (shErr) throw new Error('Failed to clean up shares: ' + shErr.message)
  }

  return { reassigned: movedIds.length, projectIds: movedIds }
}
