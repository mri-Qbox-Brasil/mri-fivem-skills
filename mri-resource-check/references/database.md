# Database tables (oxmysql)

How a resource creates and reads its tables, so a fresh install, an old install and an `ensure`
all start the same way.

## The pattern

```lua
-- server/storage.lua
local Storage = {}

-- Awaited on purpose: nothing reads before the tables exist.
function Storage.prepare()
    MySQL.query.await([[CREATE TABLE IF NOT EXISTS my_res_things (
        id INT AUTO_INCREMENT PRIMARY KEY,
        label VARCHAR(64) NOT NULL
    )]])
    -- a column added after the first release
    if not Storage.hasColumn('my_res_things', 'color') then
        MySQL.query.await("ALTER TABLE my_res_things ADD COLUMN color VARCHAR(16) NOT NULL DEFAULT ''")
    end
end

function Storage.hasColumn(tableName, column)
    return (MySQL.scalar.await([[SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?]], { tableName, column }) or 0) > 0
end

return Storage
```

```lua
-- server/main.lua
MySQL.ready(function()
    Storage.prepare()
    Things = Storage.load()
    ready = true
    publish()
end)
```

- **Schema in Lua, every start.** `CREATE TABLE IF NOT EXISTS` for every table, in the order the
  foreign keys need. No `install.sql` for the owner to import and no "first install" check: a
  table added in a later version, or one that failed on the first start, gets created on the next.
- **One entry point.** `MySQL.ready` runs `prepare`, then the loads, then whatever depends on
  them, in sequence. Threads, exports and callbacks that read the database check a `ready` flag
  (callbacks answer `not_ready`), or are started from inside that function.
- **Never poll for the schema.** A `while not schemaReady do Wait(100) end` with a timeout hides
  the real order and, when the timeout passes, runs the queries anyway with no error in the log.
  If something has to wait, start it from the ready function. An export or a thread in another
  file that must answer with data awaits a promise the start resolves:
  `local schema = promise.new()` / `function WaitForSchema() Citizen.Await(schema) end` /
  `schema:resolve(true)` right after `prepare()`.
- **`MySQL.ready` runs at once when oxmysql is already up**, while the manifest is still loading:
  functions from files listed after it do not exist yet (`attempt to call a nil value`). With the
  start spread over several files, run it from `onResourceStart` with `MySQL.ready.await()`, then
  `prepare()`, then the rest, as mri_Qbossmenu does.
- **No `pcall` around the schema.** A failed `CREATE` or `ALTER` must show in the console; a
  swallowed error leaves the resource running on missing tables.
- **New column:** check `information_schema.COLUMNS` (or ``SHOW COLUMNS FROM `t` LIKE 'c'``)
  before the `ALTER`. Never `ADD COLUMN IF NOT EXISTS`: MariaDB has it, MySQL 8 does not.
- **Table names:** a prefix of the resource name in lowercase (`mri_qstashes_stashes`), so two
  resources never share a table by accident.
- **Something that must run before the database** (registering jobs before a framework cleanup
  pass, for example) runs from `onResourceStart` without touching the database, and the part
  that reads saved rows comes later from the ready function. Write down why in one line.

## Moving an old resource to it

1. Copy every statement of the `.sql` file into `Storage.prepare()`, same order, and delete the
   file (and its mention in the README and the manifest `files`).
2. Find every query that runs at boot: `CreateThread` at file level, `onResourceStart`,
   `MySQL.ready`, exports called by other resources while starting. Move them into the ready
   function, or gate them on the `ready` flag.
3. Remove the polling waits and the `pcall`s around the schema.
4. A new file in the manifest (`schema.lua`) needs the server `refresh` before the `ensure`, or
   the old manifest starts without it.
5. `ensure` on a database where the tables exist, then on one without them (or a renamed
   prefix), and read the console both times.
