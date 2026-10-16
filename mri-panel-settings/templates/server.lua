--- Options edited in the admin panel; data/settings.json stays off files{} so secrets never reach players
--- Needs: ApplySettings (apply.lua), an IsAdmin(source) check, ox_lib callbacks.
local RES <const> = GetCurrentResourceName()
local FILE <const> = 'data/settings.json'
local STATE_KEY <const> = RES .. ':settings'
local PRIVATE <const> = { logs = true } -- sections that never leave the server

--- First run starts from config.lua, so a server that edited it keeps its values
local function seedPrices()
    local out = {}
    for class = 0, 21 do out[tostring(class)] = tonumber(Config.ClassPrice and Config.ClassPrice[class]) or 0 end
    return out
end

local function seedLots()
    local out = {}
    for _, lot in ipairs(Config.Lots or {}) do
        local points = {}
        for i, point in ipairs(lot.points or {}) do points[i] = { x = point.x, y = point.y, z = point.z } end
        out[#out + 1] = { label = lot.label, points = points }
    end
    return out
end

local DEFAULTS <const> = {
    general = { spawnInVehicle = Config.SpawnInVehicle == true },
    fees = { prices = seedPrices() },
    lots = { enabled = Config.UseLots == true, list = seedLots() },
    logs = { url = '' },
}

-- maps and lists taken whole from the panel (then cleaned), never merged key by key
local WHOLE <const> = {
    [DEFAULTS.lots.list] = true,
}

local current = {}

--- Copy of the defaults taking, per key, the new value or else the previous one, only when it keeps the default's type
local function merge(defaults, new, previous)
    local out = {}
    for k, v in pairs(defaults) do
        local n, p
        if type(new) == 'table' then n = new[k] end
        if type(previous) == 'table' then p = previous[k] end
        if type(v) == 'table' and WHOLE[v] then
            out[k] = type(n) == 'table' and n or type(p) == 'table' and p or v
        elseif type(v) == 'table' then
            out[k] = merge(v, n, p)
        elseif type(n) == type(v) then
            out[k] = n
        elseif type(p) == type(v) then
            out[k] = p
        else
            out[k] = v
        end
        -- every number here is a price, a count or a time
        if type(out[k]) == 'number' then out[k] = math.max(out[k], 0) end
    end
    return out
end

local function cleanPoints(list)
    local points = {}
    for _, p in ipairs(type(list) == 'table' and list or {}) do
        if type(p) == 'table' and tonumber(p.x) and tonumber(p.y) and tonumber(p.z) then
            points[#points + 1] = { x = tonumber(p.x) + 0.0, y = tonumber(p.y) + 0.0, z = tonumber(p.z) + 0.0 }
        end
    end
    return points
end

local CLEAN <const> = {
    lots = function(s)
        local out = {}
        for _, lot in ipairs(s.list) do
            local points = cleanPoints(type(lot) == 'table' and lot.points)
            local label = type(lot.label) == 'string' and lot.label:sub(1, 40) or ''
            if #points >= 3 then out[#out + 1] = { label = label ~= '' and label or ('Lot ' .. #out + 1), points = points } end
        end
        s.list = out
    end,
}

local function publish()
    local public = {}
    for section, values in pairs(current) do
        if not PRIVATE[section] then public[section] = values end
    end
    ApplySettings(public)
    GlobalState[STATE_KEY] = public
end

local function load()
    local ok, saved = pcall(json.decode, LoadResourceFile(RES, FILE) or '')
    current = merge(DEFAULTS, ok and saved or nil)
    for section, clean in pairs(CLEAN) do clean(current[section]) end
    publish()
end
load()

local function save(section, values)
    if not DEFAULTS[section] or type(values) ~= 'table' then return false end
    current[section] = merge(DEFAULTS[section], values, current[section])
    if CLEAN[section] then CLEAN[section](current[section]) end
    if not SaveResourceFile(RES, FILE, json.encode(current, { indent = true }), -1) then return false end
    publish()
    TriggerEvent(RES .. ':server:settingsChanged', section, current[section])
    return true
end

lib.callback.register(RES .. ':getSettings', function(source)
    if not IsAdmin(source) then return false end
    return current
end)

lib.callback.register(RES .. ':saveSettings', function(source, section, values)
    if not IsAdmin(source) then return false end
    return type(section) == 'string' and save(section, values)
end)
