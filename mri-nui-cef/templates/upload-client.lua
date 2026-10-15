-- Client side: hands the NUI an upload slot and the addresses it may post to.
local RESOURCE <const> = GetCurrentResourceName()

-- The NUI is https and CEF blocks a remote http fetch: local server first, then web_baseUrl over https, then uploadPart.
RegisterNUICallback('uploadStart', function(data, cb)
    local ok, result = lib.callback.await(RESOURCE .. ':uploadStart', false, data)
    if not ok then return cb({ ok = false, error = result }) end

    local urls = {}
    local port = (GetCurrentServerEndpoint() or ''):match(':(%d+)$')
    if port then urls[#urls + 1] = ('http://127.0.0.1:%s/%s'):format(port, RESOURCE) end
    local webBase = (result.webBase or ''):gsub('^https?://', ''):gsub('/+$', '')
    if webBase ~= '' then urls[#urls + 1] = ('https://%s/%s'):format(webBase, RESOURCE) end

    cb({ ok = true, token = result.token, name = result.name, partBytes = result.partBytes, eventPartBytes = result.eventPartBytes, urls = urls })
end)

-- Bytes per second for the latent event, same rate screencapture uses for its video chunks.
local PART_BPS <const> = 5000000
local PART_TIMEOUT <const> = 60000
local partWaits = {}

RegisterNetEvent(RESOURCE .. ':uploadPartResult', function(token, result)
    local p = partWaits[token]
    if not p then return end
    partWaits[token] = nil
    p:resolve(result)
end)

-- One part in flight per upload: the NUI only sends the next after the server's answer.
RegisterNUICallback('uploadPart', function(data, cb)
    local token = data.token
    if type(token) ~= 'string' then return cb({ ok = false, error = 'upload expired' }) end

    local p = promise.new()
    partWaits[token] = p
    TriggerLatentServerEvent(RESOURCE .. ':uploadPart', PART_BPS, token, data.part, data.total, data.data)
    SetTimeout(PART_TIMEOUT, function()
        if partWaits[token] ~= p then return end
        partWaits[token] = nil
        p:resolve({ ok = false, error = 'server did not answer' })
    end)
    cb(Citizen.Await(p))
end)

RegisterNUICallback('listFiles', function(_, cb)
    cb(lib.callback.await(RESOURCE .. ':listFiles', false) or false)
end)

RegisterNUICallback('deleteFile', function(data, cb)
    cb({ ok = lib.callback.await(RESOURCE .. ':deleteFile', false, data) == true })
end)
