-- Client side: hands the NUI an upload slot and the addresses it may post to.
local RESOURCE <const> = GetCurrentResourceName()

-- The NUI is https and CEF only lets fetch reach https or localhost: local server first, then the Cfx.re proxy.
RegisterNUICallback('uploadStart', function(data, cb)
    local ok, result = lib.callback.await(RESOURCE .. ':uploadStart', false, data)
    if not ok then return cb({ ok = false, error = result }) end

    local urls = {}
    local port = (GetCurrentServerEndpoint() or ''):match(':(%d+)$')
    if port then urls[#urls + 1] = ('http://127.0.0.1:%s/%s'):format(port, RESOURCE) end
    local webBase = (result.webBase or ''):gsub('^https?://', ''):gsub('/+$', '')
    if webBase ~= '' then urls[#urls + 1] = ('https://%s/%s'):format(webBase, RESOURCE) end

    cb({ ok = true, token = result.token, name = result.name, partBytes = result.partBytes, urls = urls })
end)

RegisterNUICallback('listFiles', function(_, cb)
    cb(lib.callback.await(RESOURCE .. ':listFiles', false) or false)
end)

RegisterNUICallback('deleteFile', function(data, cb)
    cb({ ok = lib.callback.await(RESOURCE .. ':deleteFile', false, data) == true })
end)
