-- World placement tools for admin panels: a see-through ghost to drop a point, and a path recorder.
-- Copy into client/, rename the global, and keep the rules from SKILL.md.

WorldPlacer = {}

local ROTATE_SPEED = 90.0
local WHEEL_STEP = 15.0
local RAY_DISTANCE = 30.0
-- Weapon wheel, attacks, vehicle weapon scroll and Esc (200), so the keys only drive the tool.
local BLOCKED_CONTROLS = { 14, 15, 16, 17, 24, 25, 37, 44, 140, 141, 142, 200 }
local KEY = { mark = 38, undo = 177, finish = 191, cancel = 200, left = 174, right = 175, wheelUp = 15, wheelDown = 14 }
local START_COLOR = { 0, 230, 153 }
local STOP_COLOR = { 255, 255, 255 }

local active = false

-- Key rail drawn by the ui_page while a tool runs (false hides it).
local function hud(data)
	SendNUIMessage({ action = 'placeHud', data = data })
end

local function block()
	for i = 1, #BLOCKED_CONTROLS do DisableControlAction(0, BLOCKED_CONTROLS[i], true) end
	DisableControlAction(0, KEY.finish, true)
end

-- The ox_lib raycast waits a frame, so it runs apart and the draw loop keeps every frame.
local function trackAim()
	local aim = {}
	CreateThread(function()
		while active do
			local hit, _, coords = lib.raycast.fromCamera(1 | 16, 4, RAY_DISTANCE)
			aim.coords = hit and coords or nil
		end
	end)
	return aim
end

local function ghostPed(model, heading)
	local hash = tonumber(model) or joaat(model)
	if not IsModelInCdimage(hash) or not pcall(lib.requestModel, hash, 10000) then return nil end
	local coords = GetEntityCoords(cache.ped)
	local ped = CreatePed(4, hash, coords.x, coords.y, coords.z, heading, false, false)
	SetModelAsNoLongerNeeded(hash)
	SetPedDefaultComponentVariation(ped)
	SetEntityAlpha(ped, 170, false)
	SetEntityCollision(ped, false, false)
	FreezeEntityPosition(ped, true)
	SetEntityInvincible(ped, true)
	SetBlockingOfNonTemporaryEvents(ped, true)
	return ped
end

local function drawStop(point, color)
	DrawMarker(1, point.x, point.y, point.z - 0.02, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.6, 0.6, 0.35, color[1], color[2], color[3], 170, false, false, 2, false, nil, nil, false)
end

function WorldPlacer.isActive()
	return active
end

function WorldPlacer.cancel()
	active = false
end

---Ghost follows the aim; arrows and wheel rotate, E confirms, Backspace or Esc cancels.
---@param opts { model: string|number, heading?: number }
---@return { coords: { x: number, y: number, z: number }, heading: number }|nil
function WorldPlacer.point(opts)
	if active then return nil end
	local heading = tonumber(opts.heading) or GetEntityHeading(cache.ped)
	local ghost = ghostPed(opts.model, heading)
	if not ghost then return nil end

	active = true
	hud({ mode = 'place' })
	local aim = trackAim()

	local result, last
	while active do
		local frame = GetFrameTime()
		block()

		local coords = aim.coords
		if coords and coords ~= last then
			last = coords
			SetEntityCoords(ghost, coords.x, coords.y, coords.z, false, false, false, false)
		end

		if IsControlPressed(0, KEY.left) then heading = heading + ROTATE_SPEED * frame end
		if IsControlPressed(0, KEY.right) then heading = heading - ROTATE_SPEED * frame end
		if IsDisabledControlJustPressed(0, KEY.wheelUp) then heading = heading + WHEEL_STEP end
		if IsDisabledControlJustPressed(0, KEY.wheelDown) then heading = heading - WHEEL_STEP end
		heading = heading % 360
		SetEntityHeading(ghost, heading)

		if IsControlJustPressed(0, KEY.mark) and last then
			PlaySoundFrontend(-1, 'SELECT', 'HUD_FRONTEND_DEFAULT_SOUNDSET', true)
			result = { coords = { x = last.x, y = last.y, z = last.z }, heading = math.floor(heading * 100 + 0.5) / 100 }
			break
		elseif IsDisabledControlJustPressed(0, KEY.cancel) or IsControlJustPressed(0, KEY.undo) then
			PlaySoundFrontend(-1, 'BACK', 'HUD_FRONTEND_DEFAULT_SOUNDSET', true)
			break
		end
		Wait(0)
	end

	active = false
	hud(false)
	DeleteEntity(ghost)
	return result
end

---Marks a path from `start`: E adds where the player aims, Backspace undoes, Enter finishes, Esc cancels.
---Finishing with no stops counts as cancel, so the caller keeps the path it had.
---@param opts { start: vector3|table, max?: integer }
---@return { x: number, y: number, z: number }[]|nil
function WorldPlacer.path(opts)
	if active then return nil end
	local s = opts.start
	if type(s) ~= 'table' and type(s) ~= 'vector3' then return nil end
	local start = vec3(s.x + 0.0, s.y + 0.0, s.z + 0.0)
	local max = opts.max or 20

	local points = {}
	active = true
	hud({ mode = 'route', count = 0 })
	local aim = trackAim()

	local result
	while active do
		block()
		local last = aim.coords

		local previous = start
		drawStop(start, START_COLOR)
		for _, point in ipairs(points) do
			local here = vec3(point.x, point.y, point.z)
			DrawLine(previous.x, previous.y, previous.z + 0.1, here.x, here.y, here.z + 0.1, START_COLOR[1], START_COLOR[2], START_COLOR[3], 220)
			drawStop(here, STOP_COLOR)
			previous = here
		end
		if last then
			DrawLine(previous.x, previous.y, previous.z + 0.1, last.x, last.y, last.z + 0.1, 255, 255, 255, 110)
			drawStop(last, STOP_COLOR)
		end

		if IsControlJustPressed(0, KEY.mark) and last and #points < max then
			points[#points + 1] = { x = last.x, y = last.y, z = last.z }
			PlaySoundFrontend(-1, 'SELECT', 'HUD_FRONTEND_DEFAULT_SOUNDSET', true)
			hud({ mode = 'route', count = #points })
		elseif IsControlJustPressed(0, KEY.undo) and #points > 0 then
			points[#points] = nil
			PlaySoundFrontend(-1, 'BACK', 'HUD_FRONTEND_DEFAULT_SOUNDSET', true)
			hud({ mode = 'route', count = #points })
		elseif IsDisabledControlJustPressed(0, KEY.finish) then
			result = #points > 0 and points or nil
			break
		elseif IsDisabledControlJustPressed(0, KEY.cancel) then
			PlaySoundFrontend(-1, 'BACK', 'HUD_FRONTEND_DEFAULT_SOUNDSET', true)
			break
		end
		Wait(0)
	end

	active = false
	hud(false)
	return result
end
