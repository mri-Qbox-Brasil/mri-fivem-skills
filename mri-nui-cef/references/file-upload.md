# Uploading files from the NUI to the server

For an admin panel that takes a video, music or image and saves it inside the resource.
Validated in game on FXServer (Windows, October 2026): a 30 MB video uploaded from a NUI
panel, saved, listed and deleted. The body limit was measured with `curl` against a handler
that echoed the byte count.

## Path of the bytes

1. The NUI asks Lua for an upload slot (NUI callback, then `lib.callback` to the server). The
   server checks permission, extension and size, picks a safe file name and returns a random
   token.
2. The NUI posts the file in parts straight to the server's HTTP port, to
   `/<resource>/upload/<token>/<part>/<total>`, served by `SetHttpHandler`. Never through a
   net event: a latent event moves ~300 KB/s and a big payload stalls the client.
3. On the last part the server joins the parts and saves the file.

Templates: `templates/upload-server.lua`, `templates/upload-files.js`,
`templates/upload-client.lua`, `templates/upload.js`.

## Rules

- **5 MiB per request.** FXServer's HTTP server drops a request whose body is over 5 MiB
  (5120 KB arrives, 5121 KB is cut and the client gets no answer). Send parts of 4 MiB.
- **Binary body:** `req.setDataHandler(function(body) ... end, 'binary')`. JSON with base64
  grows the file by a third and keeps it twice in memory.
- **`SaveResourceFile(res, path, data, #data)`**, never `-1`: with `-1` the length is taken
  as a C string and a binary file is saved empty (or cut) at its first zero byte.
- **Where the NUI can reach:** the page is https and CEF only lets `fetch` go to https or to
  localhost. Candidates, in order: `http://127.0.0.1:<port>/<resource>` (port from
  `GetCurrentServerEndpoint()`, works when the server runs on the same PC) and
  `https://<web_baseUrl>/<resource>` (the Cfx.re proxy, `GetConvar('web_baseUrl')`, set only
  after the server authenticates with Cfx.re). Ping each with a 1 s timeout and use the first
  that answers.
- **CORS:** answer `OPTIONS` and send `Access-Control-Allow-Origin: *`, except through the
  proxy (`Host` ending in `users.cfx.re`, or `X-Forwarded-For` / `X-Cfx-Source-Ip` present):
  the proxy already adds it, and two values make the browser block the answer.
- **File name** comes from the server, never from the client as is: lowercase, only
  `[a-z0-9_-]`, extension from an allow list, and a suffix (`-2`) instead of overwriting.
  The delete route accepts only names of that same shape, so no `..` or `/` reaches the disk.
- **Token** per player and per file, expires after 60 s without a part, dropped on
  `playerDropped`. Parts must arrive in order; anything else closes the slot.
- **Listing a folder:** Lua has no directory listing. A server `.js` in the same resource
  exports it (`fs.readdirSync`); Lua calls `exports[GetCurrentResourceName()]:listX()`.
  Delete from the same file (`fs.unlinkSync`).
- **Players only get a new file after the resource restarts:** the client download list is
  built when the resource starts, so the folder must already be in a `files` glob
  (`'config/video/*'`).
- **A resource can't restart itself.** `StopResource(GetCurrentResourceName())` does nothing
  (no log line), and `ExecuteCommand('refresh')` / `ExecuteCommand('ensure x')` fail with
  "Access denied" unless the server.cfg grants `add_ace resource.<name> command.ensure allow`.
  Have another resource do `StopResource` + `StartResource` (an admin panel's own resource
  action), or tell the admin to restart it.
- Restart once after a batch (debounce a few seconds after the last delete), not per file.
- **File input** (`<input type="file">`) opens the Windows file picker inside the NUI,
  including inside an admin panel's iframe.
- Limit sizes per kind (e.g. video 100 MB, image 10 MB): every new player downloads the file
  once on first connect.

## Video files

- Check the source before compressing: `ffprobe -v error -show_entries
  stream=codec_name,width,height,bit_rate -of compact file.mp4`. A video downloaded from
  YouTube is already compressed (around 1 to 1.5 Mbps at 1080p): re-encoding it only adds
  blocking and jagged edges, and CRF encodes come out bigger. Leave it as is.
- A video with a high bitrate (5 Mbps and up, e.g. straight from an AI generator or a screen
  recorder) drops to a quarter with `-c:v libx264 -crf 26 -preset slow -movflags +faststart`.
  WebM/VP9 at the same quality is only ~5% smaller than that and takes longer to encode.
- H.264 MP4 and VP9 WebM both play in CEF 103.
