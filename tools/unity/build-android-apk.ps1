<#
.SYNOPSIS
  Digit-Duel Unity 프로젝트의 Android 개발 APK를 재현 가능하게 빌드한다 (#182).

.DESCRIPTION
  Unity 를 배치 모드로 띄워 DigitDuel.Editor.Build.AndroidBuildCommand.BuildDevelopmentApk 를 실행한다.
  실제 Player 설정(IL2CPP · ARM64 · 세로 · target/min SDK)은 AndroidPlayerConfigurator 가 원본이며
  이 스크립트는 그 진입점만 호출한다 — 설정을 여기서 중복해서 정의하지 않는다.

  배치 모드에서는 명령줄 -buildTarget Android 가 필수다. executeMethod 안의 SwitchActiveBuildTarget 은
  도메인 리로드를 동반해 시작 시점의 타깃 지정을 대신할 수 없다.
  https://docs.unity3d.com/kr/6000.0/Manual/build-command-line.html

  같은 프로젝트를 연 Editor 가 떠 있으면 프로젝트 잠금 때문에 실패한다. 먼저 닫아야 한다:
    unity close "<repo>\unity"

  경로에 공백이 있어도 동작한다. Start-Process -ArgumentList 는 배열을 공백으로 이어 붙이기만 하고
  따옴표를 붙여 주지 않으므로, 네이티브 인자를 여기서 직접 인용한다.

.PARAMETER ProjectPath
  Unity 프로젝트 경로. 기본값은 이 스크립트 기준 <repo>\unity 다. 상대 경로도 받는다.

.PARAMETER UnityExe
  사용할 Editor 실행 파일. 기본값은 6000.6.0f1 Hub 설치 경로다.

.PARAMETER LogFile
  Unity 배치 로그 경로. 기본값은 <project>\Logs\android-build-<타임스탬프>.log 다(git 에서 제외됨).
  고정 이름을 쓰면 재빌드가 직전 실패 로그를 덮어써서 원인 증거가 사라진다(#182에서 실제로 잃었다).
  명시적으로 경로를 주면 그 경로를 그대로 쓴다.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/unity/build-android-apk.ps1
#>
[CmdletBinding()]
param(
    [string]$ProjectPath,
    [string]$UnityExe = "C:\Program Files\Unity\Hub\Editor\6000.6.0f1\Editor\Unity.exe",
    [string]$LogFile
)

$ErrorActionPreference = "Stop"

function Resolve-PathAllowMissing {
    <#
      상대 경로를 현재 위치가 아니라 호출자가 의도한 기준으로 일관되게 절대 경로로 바꾼다.
      아직 없는 경로(로그 파일)도 처리해야 하므로 Resolve-Path 를 쓰지 않는다.
    #>
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$BaseDirectory)

    if ([System.IO.Path]::IsPathRooted($Path)) {
        return [System.IO.Path]::GetFullPath($Path)
    }
    return [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($BaseDirectory, $Path))
}

function ConvertTo-NativeArgument {
    <#
      Start-Process -ArgumentList 는 문자열 배열을 공백으로 이어 붙이기만 한다. 공백이 든 값은
      여기서 따옴표로 감싸지 않으면 인자 두 개로 쪼개진다. 값 끝의 역슬래시는 Windows 인자 규칙상
      닫는 따옴표를 이스케이프해 버리므로 두 배로 늘린다.
    #>
    param([Parameter(Mandatory)][AllowEmptyString()][string]$Value)

    if ($Value -notmatch '[\s"]') { return $Value }

    $escaped = $Value -replace '(\\*)"', '$1$1\"'
    $escaped = $escaped -replace '(\\+)$', '$1$1'
    return '"' + $escaped + '"'
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $ProjectPath) { $ProjectPath = Join-Path $repoRoot "unity" }
$ProjectPath = Resolve-PathAllowMissing -Path $ProjectPath -BaseDirectory (Get-Location).Path

if (-not $LogFile) {
    # 타임스탬프를 붙여 이전 빌드 로그를 덮어쓰지 않는다.
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $LogFile = Join-Path $ProjectPath "Logs\android-build-$stamp.log"
}
$LogFile = Resolve-PathAllowMissing -Path $LogFile -BaseDirectory (Get-Location).Path
if (Test-Path -LiteralPath $LogFile) {
    throw "로그 파일이 이미 있다. 덮어쓰면 이전 빌드 증거를 잃는다: $LogFile"
}

if (-not (Test-Path -LiteralPath $UnityExe)) {
    throw "Unity Editor 를 찾지 못했다: $UnityExe"
}
if (-not (Test-Path -LiteralPath (Join-Path $ProjectPath "Assets"))) {
    throw "Unity 프로젝트가 아니다: $ProjectPath"
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LogFile) | Out-Null

$apkPath = Join-Path $ProjectPath "Builds\Android\DigitDuel-dev.apk"
if (Test-Path -LiteralPath $apkPath) { Remove-Item -LiteralPath $apkPath -Force }

$unityArgs = @(
    "-quit"
    "-batchmode"
    "-nographics"
    "-buildTarget", "Android"
    "-projectPath", (ConvertTo-NativeArgument $ProjectPath)
    "-executeMethod", "DigitDuel.Editor.Build.AndroidBuildCommand.BuildDevelopmentApk"
    "-logFile", (ConvertTo-NativeArgument $LogFile)
)

Write-Output "Unity  : $UnityExe"
Write-Output "Project: $ProjectPath"
Write-Output "Log    : $LogFile"
Write-Output "APK    : $apkPath"

$process = Start-Process -FilePath $UnityExe -ArgumentList $unityArgs -PassThru -Wait -WindowStyle Hidden
$exitCode = $process.ExitCode

Write-Output "Unity exit code: $exitCode"

if ($exitCode -ne 0) {
    throw "Unity 배치 빌드가 실패했다 (exit $exitCode). 로그를 확인한다: $LogFile"
}
if (-not (Test-Path -LiteralPath $apkPath)) {
    throw "빌드는 성공을 보고했지만 APK 가 없다: $apkPath"
}

$size = (Get-Item -LiteralPath $apkPath).Length
Write-Output "APK OK: $apkPath ($size bytes)"
