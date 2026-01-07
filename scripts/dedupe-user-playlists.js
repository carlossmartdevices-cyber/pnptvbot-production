#!/usr/bin/env node
/* eslint-disable no-console */

const db = require('../src/config/postgres')

function hasFlag(flag) {
  return process.argv.includes(flag)
}

function getArgValue(name, fallback) {
  const idx = process.argv.findIndex((a) => a === name)
  if (idx === -1) return fallback
  const v = process.argv[idx + 1]
  if (!v || v.startsWith('-')) return fallback
  return v
}

function usage(exitCode = 0) {
  console.log(`Usage:
  node scripts/dedupe-user-playlists.js [--apply] [--limit N]

Options:
  --apply     Actually delete duplicates (default is dry-run)
  --limit N   Only show first N duplicate groups (default 50)
`)
  process.exit(exitCode)
}

async function main() {
  if (hasFlag('-h') || hasFlag('--help')) usage(0)

  const apply = hasFlag('--apply')
  const limit = Math.max(1, Math.min(500, parseInt(getArgValue('--limit', '50'), 10) || 50))

  const tableCheck = await db.query(
    `SELECT to_regclass('public.user_playlists') AS name`,
    [],
    { cache: false }
  )
  const tableName = tableCheck.rows?.[0]?.name
  if (!tableName) {
    console.log('Table not found: public.user_playlists')
    return
  }

  const summary = await db.query(
    `
    WITH ranked AS (
      SELECT
        id,
        user_id,
        COALESCE(category, '') AS category,
        COALESCE(title, '') AS title,
        COALESCE(creator_name, '') AS creator_name,
        ROW_NUMBER() OVER (
          PARTITION BY user_id, COALESCE(category, ''), COALESCE(title, ''), COALESCE(creator_name, '')
          ORDER BY created_at DESC NULLS LAST, id DESC
        ) AS rn
      FROM user_playlists
    ),
    to_delete AS (
      SELECT id FROM ranked WHERE rn > 1
    )
    SELECT (SELECT COUNT(*) FROM to_delete) AS delete_count
    `,
    [],
    { cache: false }
  )

  const deleteCount = Number(summary.rows?.[0]?.delete_count || 0)
  console.log(`Duplicates to delete (dry-run=${!apply}): ${deleteCount}`)

  const groups = await db.query(
    `
    SELECT
      user_id,
      COALESCE(category, '') AS category,
      COALESCE(title, '') AS title,
      COALESCE(creator_name, '') AS creator_name,
      COUNT(*)::int AS count,
      MAX(created_at) AS newest
    FROM user_playlists
    GROUP BY 1,2,3,4
    HAVING COUNT(*) > 1
    ORDER BY count DESC, newest DESC NULLS LAST
    LIMIT $1
    `,
    [limit],
    { cache: false }
  )

  if (!groups.rows?.length) {
    console.log('No duplicates found.')
    return
  }

  console.log(`Duplicate groups (showing up to ${limit}):`)
  for (const g of groups.rows) {
    console.log(
      `- user_id=${g.user_id} | category="${g.category}" | title="${g.title}" | creator="${g.creator_name}" | count=${g.count}`
    )
  }

  if (!apply) {
    console.log('\nDry-run only. Re-run with --apply to delete duplicates.')
    return
  }

  console.log('\nDeleting duplicates…')
  await db.query('BEGIN', [], { cache: false })
  try {
    const deleted = await db.query(
      `
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id, COALESCE(category, ''), COALESCE(title, ''), COALESCE(creator_name, '')
            ORDER BY created_at DESC NULLS LAST, id DESC
          ) AS rn
        FROM user_playlists
      ),
      to_delete AS (
        SELECT id FROM ranked WHERE rn > 1
      )
      DELETE FROM user_playlists
      WHERE id IN (SELECT id FROM to_delete)
      `,
      [],
      { cache: false }
    )
    await db.query('COMMIT', [], { cache: false })
    console.log(`Deleted rows: ${deleted.rowCount || 0}`)
  } catch (e) {
    await db.query('ROLLBACK', [], { cache: false })
    throw e
  }
}

main()
  .catch((e) => {
    console.error('Failed:', e?.message || e)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await db.closePool()
    } catch (_) {
      // ignore
    }
  })

