--- Panel settings written over Config, on the server and on every client, so readers keep using Config
--- shared_scripts: right after config.lua. Rename RES and the sections to the resource's own.
local RES <const> = GetCurrentResourceName()
local STATE_KEY <const> = RES .. ':settings'

local function vec3Of(p) return vec3(p.x + 0.0, p.y + 0.0, p.z + 0.0) end

---@param s table? the public settings (every section but the private ones)
function ApplySettings(s)
    if type(s) ~= 'table' then return end

    if s.general then
        Config.SpawnInVehicle = s.general.spawnInVehicle
    end

    -- JSON keeps only string keys: {"0": 15000} back to [0] = 15000
    if s.fees then
        local prices = {}
        for class, price in pairs(s.fees.prices) do prices[tonumber(class)] = price end
        Config.ClassPrice = prices
    end

    -- lists of world things: plain {x, y, z} back to vectors
    if s.lots then
        local location = {}
        for i, lot in ipairs(s.lots.list) do
            local points = {}
            for j, point in ipairs(lot.points) do points[j] = vec3Of(point) end
            location[i] = { label = lot.label, points = points }
        end
        Config.UseLots = s.lots.enabled
        Config.Lots = location
    end
end

if IsDuplicityVersion() then return end

ApplySettings(GlobalState[STATE_KEY])

-- the handler runs before GlobalState holds the new value: use the parameter
AddStateBagChangeHandler(STATE_KEY, 'global', function(_, _, value)
    ApplySettings(value)
    TriggerEvent(RES .. ':client:settingsApplied')
end)
