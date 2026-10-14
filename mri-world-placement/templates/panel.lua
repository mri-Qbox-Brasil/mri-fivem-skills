-- Panel side: the NUI asks for a tool, the panel hides, the tool runs, the panel comes back with the result.
-- `setFocus`, `send` and `open` are the panel's own; PLUGIN_ID is the tab id inside mri_Qadmin.

local PLUGIN_ID = 'my_tab'

local function inWorld(draft, cb, tool)
	if type(draft) ~= 'table' or WorldPlacer.isActive() then return cb(false) end

	-- Inside mri_Qadmin the host hides (the tab stays mounted with the draft) and reopens on this tab.
	local fromAdmin = draft.embedded == true and GetResourceState('mri_Qadmin') == 'started'
	if fromAdmin then
		pcall(function() exports.mri_Qadmin:ClosePlugin() end)
	else
		setFocus(false)
		send('placing', true)
	end

	CreateThread(function()
		local result = tool(draft)
		if fromAdmin then
			pcall(function() exports.mri_Qadmin:OpenPlugin(PLUGIN_ID) end)
		else
			send('placing', false)
			if open then setFocus(true) end
		end
		cb(result or false)
	end)
end

RegisterNUICallback('place', function(draft, cb)
	inWorld(draft, cb, function(d) return WorldPlacer.point({ model = d.model, heading = d.heading }) end)
end)

RegisterNUICallback('recordRoute', function(draft, cb)
	inWorld(draft, cb, function(d) return WorldPlacer.path({ start = d.coords }) end)
end)

-- `refs` are the zones the item already has, so the admin sees them while marking new ones.
RegisterNUICallback('placeZone', function(draft, cb)
	inWorld(draft, cb, function(d) return WorldPlacer.zone({ size = d.size, multiple = d.multiple, refs = d.refs }) end)
end)
