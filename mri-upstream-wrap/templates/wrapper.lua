-- Example wrapper file: <resource>/custom/server/rates.lua, listed in the upstream fxmanifest.
-- Reads a small GlobalState key published by your own resource and adjusts the upstream live.

-- Same table the upstream reads every tick (ox_lib caches require), so changes apply at once.
local config = require 'config.server'

local KEY = 'myorg:rates'
local DEFAULT = { hungerRate = config.player.hungerRate }

local function apply(value)
	local rates = type(value) == 'table' and value or DEFAULT
	config.player.hungerRate = tonumber(rates.hungerRate) or DEFAULT.hungerRate
end

-- The new value comes in the parameter; GlobalState still holds the old one here.
AddStateBagChangeHandler(KEY, 'global', function(_, _, value)
	apply(value)
end)

apply(GlobalState[KEY])

-- Illustrative event and signature: the upstream fires it before writing the statebag, so the fix waits one tick.
AddEventHandler('upstream:server:onSetMetaData', function(source, key, _, value)
	if key ~= 'hunger' or value >= 0 then return end
	SetTimeout(0, function()
		SetMetadata(source, 'hunger', 0)
	end)
end)
