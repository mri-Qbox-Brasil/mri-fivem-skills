-- Answers exports called by the old resource name after `provide 'old_resource'` in the fxmanifest.
-- `provide` only satisfies dependencies and GetResourceState; exports['old_resource']:x() needs this.
local OLD = 'old_resource'

if cache.resource == OLD then return end

-- Each side lists only the exports it really has.
local names = IsDuplicityVersion() and {
	'getThing',
	'setThing',
} or {
	'getClosestThing',
}

local self = exports[cache.resource]

for i = 1, #names do
	local name = names[i]

	AddEventHandler(('__cfx_export_%s_%s'):format(OLD, name), function(setCB)
		setCB(function(...)
			return self[name](self, ...)
		end)
	end)
end
