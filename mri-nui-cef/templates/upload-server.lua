-- Server side of a NUI file upload (see references/file-upload.md). Needs ox_lib and upload-files.js.
-- Replace isAllowed and KINDS; every folder must be in a `files` glob of the fxmanifest.

local RESOURCE <const> = GetCurrentResourceName()
-- FXServer drops an HTTP request whose body is over 5 MiB.
local PART_BYTES <const> = 4 * 1024 * 1024
local SLOT_TTL <const> = 60
local MB <const> = 1024 * 1024

local KINDS <const> = {
    video = { folder = 'media/video', maxBytes = 100 * MB, exts = { mp4 = true, webm = true } },
    image = { folder = 'media/image', maxBytes = 10 * MB, exts = { png = true, jpg = true, jpeg = true, webp = true } },
}

local function isAllowed(source)
    return IsPlayerAceAllowed(source, RESOURCE .. '.admin')
end

local slots = {}

local function newToken()
    return ('%08x%08x%08x%08x'):format(
        math.random(0, 0xFFFFFFFF), math.random(0, 0xFFFFFFFF),
        math.random(0, 0xFFFFFFFF), math.random(0, 0xFFFFFFFF))
end

local function fileExists(path)
    local file = io.open(GetResourcePath(RESOURCE) .. '/' .. path, 'rb')
    if file then file:close() end
    return file ~= nil
end

---Safe name inside the kind's folder; never overwrites an existing file.
local function uniqueName(kind, original)
    local base, ext = tostring(original):match('^(.-)%.(%w+)$')
    ext = ext and ext:lower()
    if not ext or not kind.exts[ext] then return nil end

    base = base:lower():gsub('[^%w_%-]+', '_'):gsub('^[_%-]+', ''):sub(1, 60)
    if base == '' then base = 'file' end

    local name, n = ('%s.%s'):format(base, ext), 1
    while fileExists(('%s/%s'):format(kind.folder, name)) do
        n = n + 1
        name = ('%s-%d.%s'):format(base, n, ext)
    end
    return name
end

lib.callback.register(RESOURCE .. ':uploadStart', function(source, data)
    if not isAllowed(source) then return false, 'no permission' end
    local kind = type(data) == 'table' and KINDS[data.kind]
    if not kind then return false, 'invalid kind' end

    local size = math.tointeger(tonumber(data.size))
    if not size or size <= 0 then return false, 'empty file' end
    if size > kind.maxBytes then return false, ('over %d MB'):format(kind.maxBytes // MB) end

    local name = uniqueName(kind, data.name)
    if not name then return false, 'format not accepted' end

    for token, slot in pairs(slots) do
        if slot.src == source then slots[token] = nil end
    end

    local token = newToken()
    slots[token] = { src = source, path = ('%s/%s'):format(kind.folder, name), name = name, size = size, parts = {}, received = 0, expires = os.time() + SLOT_TTL }
    return true, { token = token, name = name, partBytes = PART_BYTES, webBase = GetConvar('web_baseUrl', '') }
end)

lib.callback.register(RESOURCE .. ':listFiles', function(source)
    if not isAllowed(source) then return false end
    local out = {}
    for id, kind in pairs(KINDS) do
        out[id] = exports[RESOURCE]:listUploadFolder(kind.folder) or {}
    end
    return out
end)

lib.callback.register(RESOURCE .. ':deleteFile', function(source, data)
    if not isAllowed(source) then return false, 'no permission' end
    local kind = type(data) == 'table' and KINDS[data.kind]
    local name = kind and type(data.name) == 'string' and data.name or ''
    -- Same shape uniqueName produces: no path separator or dot segment reaches the disk.
    if not kind or not name:match('^[%w_%-]+%.%w+$') or not kind.exts[(name:match('%.(%w+)$') or ''):lower()] then
        return false, 'invalid file'
    end
    return exports[RESOURCE]:deleteUploadFile(kind.folder, name) == true
end)

AddEventHandler('playerDropped', function()
    local src = source
    for token, slot in pairs(slots) do
        if slot.src == src then slots[token] = nil end
    end
end)

-- The Cfx.re proxy already sends Access-Control-Allow-Origin; a second one makes the browser block the answer.
local function viaProxy(req)
    for name, value in pairs(req.headers or {}) do
        local key = tostring(name):lower()
        if key == 'host' and tostring(value):find('users%.cfx%.re') then return true end
        if key == 'x-forwarded-for' or key == 'x-cfx-source-ip' then return true end
    end
    return false
end

local function reply(req, res, status, body)
    local headers = { ['Content-Type'] = 'application/json' }
    if not viaProxy(req) then
        headers['Access-Control-Allow-Origin'] = '*'
        headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        headers['Access-Control-Allow-Headers'] = 'Content-Type'
    end
    res.writeHead(status, headers)
    res.send(json.encode(body))
end

SetHttpHandler(function(req, res)
    if req.method == 'OPTIONS' then return reply(req, res, 204, {}) end
    if req.method == 'GET' and req.path == '/ping' then return reply(req, res, 200, { ok = true }) end
    if req.method ~= 'POST' then return reply(req, res, 404, { ok = false }) end

    local token, part, total = tostring(req.path):match('^/upload/(%x+)/(%d+)/(%d+)$')
    local slot = token and slots[token]
    if not slot then return reply(req, res, 403, { ok = false, error = 'upload expired' }) end

    part, total = math.tointeger(tonumber(part)), math.tointeger(tonumber(total))
    if not part or not total or part ~= #slot.parts + 1 or part > total or slot.busy or os.time() > slot.expires then
        slots[token] = nil
        return reply(req, res, 403, { ok = false, error = 'part out of order' })
    end

    slot.busy = true
    req.setDataHandler(function(body)
        slot.busy = false
        if slots[token] ~= slot then return reply(req, res, 403, { ok = false, error = 'upload expired' }) end
        if type(body) ~= 'string' or #body > PART_BYTES or slot.received + #body > slot.size then
            slots[token] = nil
            return reply(req, res, 413, { ok = false, error = 'bigger than declared' })
        end

        slot.parts[part] = body
        slot.received = slot.received + #body
        slot.expires = os.time() + SLOT_TTL
        if part < total then return reply(req, res, 200, { ok = true }) end

        slots[token] = nil
        if slot.received ~= slot.size then return reply(req, res, 400, { ok = false, error = 'incomplete' }) end

        local data = table.concat(slot.parts)
        -- Explicit length: -1 stops at the first zero byte and saves an empty file.
        if not SaveResourceFile(RESOURCE, slot.path, data, #data) then
            return reply(req, res, 500, { ok = false, error = 'save failed' })
        end
        -- Players get the file only after this resource restarts, and it can't restart itself.
        reply(req, res, 200, { ok = true, name = slot.name })
    end, 'binary')
end)

CreateThread(function()
    while true do
        Wait(30000)
        local now = os.time()
        for token, slot in pairs(slots) do
            if now > slot.expires then slots[token] = nil end
        end
    end
end)
