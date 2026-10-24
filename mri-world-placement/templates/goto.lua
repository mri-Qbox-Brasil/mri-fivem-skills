-- "Go there" for admin panels: the server checks the admin, the panel closes and the place loads before the ped lands.
-- Copy into client/, rename the global and the callback names; the server part is at the bottom.
-- NUI: the map card (MriMapSelectedCard onGoTo) and the editor rows call `goThere` with { x, y, z, embedded }.

PanelGoThere = {}

-- Far away the map, collision and navmesh aren't streamed: load them first, then find a walkable spot.
function PanelGoThere.go(x, y, z)
	DoScreenFadeOut(300)
	while not IsScreenFadedOut() do Wait(0) end
	local ped = cache.ped
	local entity = cache.vehicle and GetPedInVehicleSeat(cache.vehicle, -1) == ped and cache.vehicle or ped
	FreezeEntityPosition(entity, true)
	SetEntityCoords(entity, x, y, z, false, false, false, false)
	NewLoadSceneStartSphere(x, y, z, 80.0, 0)
	local deadline = GetGameTimer() + 8000
	repeat
		RequestCollisionAtCoord(x, y, z)
		Wait(0)
	until (IsNewLoadSceneLoaded() and HasCollisionLoadedAroundEntity(entity)
		and IsNavmeshLoadedInArea(x - 20.0, y - 20.0, z - 20.0, x + 20.0, y + 20.0, z + 20.0))
		or GetGameTimer() > deadline
	NewLoadSceneStop()
	if entity == ped then
		local found, safe = GetSafeCoordForPed(x, y, z, false, 32)
		if found then SetEntityCoords(ped, safe.x, safe.y, safe.z, false, false, false, false) end
	end
	FreezeEntityPosition(entity, false)
	DoScreenFadeIn(300)
end

-- `closePanel` is the resource's own close (SetNuiFocus false + hide); inside mri_Qadmin the host closes instead.
RegisterNUICallback('goThere', function(data, cb)
	if type(data) ~= 'table' or not tonumber(data.x) or not tonumber(data.y) or not tonumber(data.z) then return cb({ ok = false }) end
	if lib.callback.await('my_resource:server:canGoThere', false) ~= true then return cb({ ok = false, reason = 'not_allowed' }) end
	cb({ ok = true })
	if data.embedded == true and GetResourceState('mri_Qadmin') == 'started' then
		exports.mri_Qadmin:ClosePlugin()
	else
		closePanel()
	end
	PanelGoThere.go(data.x + 0.0, data.y + 0.0, data.z + 0.0)
end)

--[[ server: IsAdmin from the mri-resource-check skill (Admin check), the same ACE as the plugin requiredPerms.
lib.callback.register('my_resource:server:canGoThere', function(src) return IsAdmin(src) end)
]]
