# Extracts a file by name from the game's encrypted .rpf packages, through the user's own CodeWalker install.
# Windows PowerShell 5.1 (CodeWalker 30 targets .NET Framework). Nothing is bundled: the DLL is loaded from -CodeWalker.
#   .\rpf-extract.ps1 -Game "<GTA V folder>" -CodeWalker "<CodeWalker folder>" -Name pause_menu_pages_map.gfx -Out .\out
param(
  [Parameter(Mandatory)] [string]$Game,
  [Parameter(Mandatory)] [string]$CodeWalker,
  [Parameter(Mandatory)] [string]$Name,
  [string]$Out
)
$ErrorActionPreference = 'Stop'
$dll = Join-Path $CodeWalker 'CodeWalker.Core.dll'
if (-not (Test-Path $dll)) { throw "CodeWalker.Core.dll not found in $CodeWalker" }
$asm = [Reflection.Assembly]::LoadFrom($dll)

# Keys are read from the game's own executable, so the game folder must be a legacy (non Enhanced) install.
# Signatures change between CodeWalker builds: dev46 has no Enhanced flag, later builds add it.
$load = $asm.GetType('CodeWalker.GameFiles.GTA5Keys').GetMethod('LoadFromPath')
if ($load.GetParameters().Count -eq 2) { [void]$load.Invoke($null, @($Game, $null)) } else { [void]$load.Invoke($null, @($Game, $false, $null)) }
$manager = [Activator]::CreateInstance($asm.GetType('CodeWalker.GameFiles.RpfManager'))
$quiet = [Action[string]] { param($s) }
$init = $manager.GetType().GetMethods() | Where-Object { $_.Name -eq 'Init' -and $_.GetParameters()[0].ParameterType -eq [string] }
if ($init.GetParameters().Count -eq 5) { $manager.Init($Game, $quiet, $quiet, $false, $true) } else { $manager.Init($Game, $false, $quiet, $quiet, $false, $true) }

$hits = foreach ($rpf in $manager.AllRpfs) {
  foreach ($entry in $rpf.AllEntries) { if ($entry.Name -ieq $Name) { $entry.Path } }
}
if (-not $hits) { Write-Output "not found: $Name"; exit 1 }
$hits

if ($Out) {
  New-Item -ItemType Directory -Force $Out | Out-Null
  foreach ($path in $hits) {
    $bytes = $manager.GetFileData($path)
    $file = Join-Path $Out ($path -replace '[\\/:]', '_')
    [IO.File]::WriteAllBytes($file, $bytes)
    Write-Output "$file ($($bytes.Length) bytes)"
  }
}
