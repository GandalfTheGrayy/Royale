Add-Type -AssemblyName System.Drawing

$sourceDirectory = Join-Path $PSScriptRoot "..\public\assets\slots\baykus-madeni\components-v3"
$outputDirectory = Join-Path $PSScriptRoot "..\public\assets\slots\baykus-madeni\components-v4"
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

$cleanerSource = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;

public static class PickaxeComponentCleaner
{
    public static int Clean(string sourcePath, string outputPath)
    {
        using (var source = new Bitmap(sourcePath))
        {
            int width = source.Width;
            int height = source.Height;
            var visited = new bool[width * height];
            var largest = new List<int>();
            int[] dx = { -1, 0, 1, -1, 1, -1, 0, 1 };
            int[] dy = { -1, -1, -1, 0, 0, 1, 1, 1 };

            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    int start = y * width + x;
                    if (visited[start] || source.GetPixel(x, y).A == 0) continue;

                    var component = new List<int>();
                    var queue = new Queue<int>();
                    queue.Enqueue(start);
                    visited[start] = true;

                    while (queue.Count > 0)
                    {
                        int point = queue.Dequeue();
                        component.Add(point);
                        int pointX = point % width;
                        int pointY = point / width;

                        for (int index = 0; index < 8; index++)
                        {
                            int nextX = pointX + dx[index];
                            int nextY = pointY + dy[index];
                            if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
                            int next = nextY * width + nextX;
                            if (visited[next] || source.GetPixel(nextX, nextY).A == 0) continue;
                            visited[next] = true;
                            queue.Enqueue(next);
                        }
                    }

                    if (component.Count > largest.Count) largest = component;
                }
            }

            using (var output = new Bitmap(width, height, PixelFormat.Format32bppArgb))
            {
                foreach (int point in largest)
                {
                    int x = point % width;
                    int y = point / width;
                    output.SetPixel(x, y, source.GetPixel(x, y));
                }
                output.Save(outputPath, ImageFormat.Png);
            }

            return largest.Count;
        }
    }
}
'@

Add-Type -TypeDefinition $cleanerSource -ReferencedAssemblies System.Drawing

Get-ChildItem -LiteralPath $sourceDirectory -Filter "pickaxe-*-v3.png" | ForEach-Object {
    $outputName = $_.Name -replace "-v3\.png$", "-v4.png"
    $outputPath = Join-Path $outputDirectory $outputName
    $keptPixels = [PickaxeComponentCleaner]::Clean($_.FullName, $outputPath)
    Write-Output "$outputName : $keptPixels connected pixels kept"
}
