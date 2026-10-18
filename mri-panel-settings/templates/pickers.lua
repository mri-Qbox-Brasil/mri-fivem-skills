--- Server lists for the panel pickers (jobs/gangs with grades, items, characters): nothing is typed by hand
--- Needs: an IsAdmin(source) check, ox_lib callbacks, oxmysql for characters. Rename RES to the resource.
local RES <const> = GetCurrentResourceName()

local function addGroups(options, groups, kind)
    for name, group in pairs(type(groups) == 'table' and groups or {}) do
        local grades = {}
        for level, grade in pairs(type(group) == 'table' and type(group.grades) == 'table' and group.grades or {}) do
            grades[#grades + 1] = { value = tonumber(level) or 0, label = type(grade) == 'table' and grade.name or tostring(level) }
        end
        table.sort(grades, function(a, b) return a.value < b.value end)
        options[#options + 1] = { value = name, label = type(group) == 'table' and group.label or name, kind = kind, grades = grades }
    end
end

-- Jobs and gangs in one list, each with its grades for the minimum grade choice
lib.callback.register(RES .. ':server:groupOptions', function(source)
    if not IsAdmin(source) or GetResourceState('qbx_core') ~= 'started' then return {} end
    local options = {}
    addGroups(options, exports.qbx_core:GetJobs(), 'job')
    addGroups(options, exports.qbx_core:GetGangs(), 'gang')
    table.sort(options, function(a, b) return tostring(a.label):lower() < tostring(b.label):lower() end)
    return options
end)

lib.callback.register(RES .. ':server:itemOptions', function(source)
    if not IsAdmin(source) or GetResourceState('ox_inventory') ~= 'started' then return {} end
    local options = {}
    for name, item in pairs(exports.ox_inventory:Items() or {}) do
        options[#options + 1] = { value = name, label = type(item) == 'table' and item.label or name }
    end
    table.sort(options, function(a, b) return tostring(a.label):lower() < tostring(b.label):lower() end)
    return options
end)

-- Every character, online or not, by name
lib.callback.register(RES .. ':server:characterOptions', function(source)
    if not IsAdmin(source) or GetResourceState('qbx_core') ~= 'started' then return {} end
    local options = {}
    for _, row in ipairs(MySQL.query.await('SELECT citizenid, charinfo FROM players') or {}) do
        local ok, info = pcall(json.decode, row.charinfo or '')
        local name = ok and type(info) == 'table' and ('%s %s'):format(info.firstname or '', info.lastname or ''):match('^%s*(.-)%s*$') or ''
        options[#options + 1] = { value = row.citizenid, label = name ~= '' and name or row.citizenid }
    end
    table.sort(options, function(a, b) return a.label:lower() < b.label:lower() end)
    return options
end)

-- Client side, one NUI callback per list:
-- RegisterNUICallback('getItemOptions', function(_, cb)
--     cb(lib.callback.await(RES .. ':server:itemOptions', false) or {})
-- end)
