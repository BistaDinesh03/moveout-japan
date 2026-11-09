# Generates the raster brand assets (PNG icons, apple-touch icon, social card and
# favicon.ico) from the same geometry as the SVG artwork.
# Run from the repository root:  powershell -ExecutionPolicy Bypass -File scripts/generate-brand-assets.ps1
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$favicon = Join-Path $root 'favicon'
$brand = Join-Path $root 'assets\images\brand'
New-Item -ItemType Directory -Force -Path $favicon, $brand | Out-Null

$navy = [System.Drawing.ColorTranslator]::FromHtml('#0b1f3a')
$red  = [System.Drawing.ColorTranslator]::FromHtml('#b5121b')
$white = [System.Drawing.Color]::White

function New-RoundedPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function New-Point([float]$x, [float]$y) {
  return [System.Drawing.PointF]::new($x, $y)
}

function New-RoundPen($colour, [float]$width) {
  $pen = New-Object System.Drawing.Pen($colour, $width)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $pen
}

function New-SymbolBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $s = [float]($size / 64.0)
  $bg = New-RoundedPath 0 0 $size $size (14 * $s)
  $g.FillPath((New-Object System.Drawing.SolidBrush($navy)), $bg)

  # Rising-sun accent behind the roof.
  $g.FillEllipse((New-Object System.Drawing.SolidBrush($red)), (45 - 7) * $s, (19 - 7) * $s, 14 * $s, 14 * $s)

  $pen = New-RoundPen $white (4.5 * $s)

  # Roof.
  $g.DrawLines($pen, [System.Drawing.PointF[]]@(
    (New-Point (13 * $s) (33.5 * $s)),
    (New-Point (32 * $s) (16 * $s)),
    (New-Point (51 * $s) (33.5 * $s))
  ))

  # Walls.
  $g.DrawLines($pen, [System.Drawing.PointF[]]@(
    (New-Point (18.5 * $s) (31.5 * $s)),
    (New-Point (18.5 * $s) (48 * $s)),
    (New-Point (22.5 * $s) (52 * $s)),
    (New-Point (41.5 * $s) (52 * $s)),
    (New-Point (45.5 * $s) (48 * $s)),
    (New-Point (45.5 * $s) (31.5 * $s))
  ))

  # Door.
  $doorPen = New-RoundPen $white (4 * $s)
  $g.DrawLines($doorPen, [System.Drawing.PointF[]]@(
    (New-Point (28 * $s) (52 * $s)),
    (New-Point (28 * $s) (40 * $s)),
    (New-Point (36 * $s) (40 * $s)),
    (New-Point (36 * $s) (52 * $s))
  ))

  $g.Dispose()
  $pen.Dispose(); $doorPen.Dispose(); $bg.Dispose()
  return $bmp
}

function Save-Png($bitmap, [string]$path) {
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

# App icons.
foreach ($size in 32, 96, 180, 192, 512) {
  $bmp = New-SymbolBitmap $size
  $name = switch ($size) {
    96  { 'favicon-96x96.png' }
    180 { 'apple-touch-icon.png' }
    192 { 'web-app-manifest-192x192.png' }
    512 { 'web-app-manifest-512x512.png' }
    default { "favicon-$size`x$size.png" }
  }
  Save-Png $bmp (Join-Path $favicon $name)
}

# Social sharing card (1200 x 630).
$w = 1200; $h = 630
$social = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($social)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.Clear($navy)

# Decorative sun rings.
$g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 181, 18, 27))), 800, -60, 420, 420)
$g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(56, 181, 18, 27))), 890, 30, 240, 240)

# White tile + navy symbol.
$tileX = 96; $tileY = 120
$g.FillPath((New-Object System.Drawing.SolidBrush($white)), (New-RoundedPath $tileX $tileY 132 132 30))
$g.FillEllipse((New-Object System.Drawing.SolidBrush($red)), ($tileX + 78), ($tileY + 24), 30, 30)

$symPen = New-RoundPen $navy 9
$g.DrawLines($symPen, [System.Drawing.PointF[]]@(
  (New-Point ($tileX + 27) ($tileY + 69)),
  (New-Point ($tileX + 66) ($tileY + 33)),
  (New-Point ($tileX + 105) ($tileY + 69))
))
$g.DrawLines($symPen, [System.Drawing.PointF[]]@(
  (New-Point ($tileX + 38) ($tileY + 65)),
  (New-Point ($tileX + 38) ($tileY + 99)),
  (New-Point ($tileX + 46) ($tileY + 107)),
  (New-Point ($tileX + 86) ($tileY + 107)),
  (New-Point ($tileX + 94) ($tileY + 99)),
  (New-Point ($tileX + 94) ($tileY + 65))
))
$doorPen = New-RoundPen $navy 8
$g.DrawLines($doorPen, [System.Drawing.PointF[]]@(
  (New-Point ($tileX + 58) ($tileY + 107)),
  (New-Point ($tileX + 58) ($tileY + 84)),
  (New-Point ($tileX + 74) ($tileY + 84)),
  (New-Point ($tileX + 74) ($tileY + 107))
))

$fontWord = New-Object System.Drawing.Font('Segoe UI', 70, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fontTag  = New-Object System.Drawing.Font('Segoe UI', 34, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$fontSub  = New-Object System.Drawing.Font('Segoe UI', 26, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$whiteBrush = New-Object System.Drawing.SolidBrush($white)
$mutedBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#c7d2e3'))
$subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#93a4bd'))
$g.DrawString('Move Out Japan', $fontWord, $whiteBrush, 92, 262)
$g.DrawString('Moving and Living in Japan, Made Easier.', $fontTag, $mutedBrush, 96, 380)
$g.FillRectangle((New-Object System.Drawing.SolidBrush($red)), 96, 470, 86, 6)
$g.DrawString('Practical English-language guides for everyday life in Japan', $fontSub, $subBrush, 96, 506)

$g.Dispose()
$social.Save((Join-Path $brand 'move-out-japan-social.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$social.Dispose()

# Build favicon.ico from the 32px PNG (PNG-compressed ICO entry, supported by
# every current browser).
$pngPath = Join-Path $favicon 'favicon-32x32.png'
$png = [System.IO.File]::ReadAllBytes($pngPath)
$ico = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ico)
$bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([byte]1); $bw.Write([byte]0)
$bw.Write([byte]1); $bw.Write([byte]0)
$bw.Write([byte]32); $bw.Write([byte]32); $bw.Write([byte]0); $bw.Write([byte]0)
$bw.Write([uint16]1); $bw.Write([uint16]32)
$bw.Write([uint32]$png.Length); $bw.Write([uint32]22)
$bw.Write($png)
$bw.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $favicon 'favicon.ico'), $ico.ToArray())
$bw.Dispose(); $ico.Dispose()

Write-Host 'Brand assets generated.'
