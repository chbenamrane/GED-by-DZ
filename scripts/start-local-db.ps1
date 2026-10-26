$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pgBin = 'C:\Program Files\PostgreSQL\17\bin'
$dataDirectory = Join-Path $projectRoot 'storage\postgres'
$envFile = Join-Path $projectRoot '.env'
if (-not (Test-Path -LiteralPath $pgBin)) { throw 'PostgreSQL 17 doit être installé ou utilisez votre propre DATABASE_URL.' }
if (-not (Test-Path -LiteralPath $dataDirectory)) {
    if (Test-Path -LiteralPath $envFile) { throw 'Un fichier .env existe déjà. Configurez sa base ou déplacez-le avant d’initialiser une base isolée.' }
    $random = New-Object byte[] 24
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($random)
    $password = [Convert]::ToBase64String($random)
    $secret = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($secret)
    $key = -join ($secret | ForEach-Object { $_.ToString('x2') })
    New-Item -ItemType Directory -Path (Join-Path $projectRoot 'storage') -Force | Out-Null
    $passwordFile = Join-Path $projectRoot 'storage\.init-password'
    [IO.File]::WriteAllText($passwordFile, $password, [Text.UTF8Encoding]::new($false))
    try {
        & "$pgBin\initdb.exe" -D $dataDirectory -U ged --encoding=UTF8 --locale=C --auth=scram-sha-256 "--pwfile=$passwordFile"
        if ($LASTEXITCODE -ne 0) { throw 'Échec de initdb.' }
        Add-Content -LiteralPath (Join-Path $dataDirectory 'postgresql.conf') -Value "`nlisten_addresses = '127.0.0.1'`nport = 55432"
        $escaped = [Uri]::EscapeDataString($password)
        $content = "DATABASE_URL=`"postgresql://ged:${escaped}@127.0.0.1:55432/ged_by_dz`"`nAPP_URL=`"http://localhost:3000`"`nSTORAGE_DIR=`"./storage`"`nSETTINGS_ENCRYPTION_KEY=`"$key`"`n"
        [IO.File]::WriteAllText($envFile,$content,[Text.UTF8Encoding]::new($false))
    } finally { Remove-Item -LiteralPath $passwordFile -ErrorAction SilentlyContinue }
}
& "$pgBin\pg_ctl.exe" -D $dataDirectory status 2>$null
if ($LASTEXITCODE -ne 0) {
    $log = Join-Path $projectRoot 'storage\postgres.log'
    $process = Start-Process -FilePath "$pgBin\pg_ctl.exe" -ArgumentList @('-D',"`"$dataDirectory`"",'-l',"`"$log`"",'-w','start') -WindowStyle Hidden -PassThru -Wait
    if ($process.ExitCode -ne 0) { throw 'Impossible de démarrer PostgreSQL local.' }
}
node --env-file=.env --input-type=module -e "import pg from 'pg';const u=new URL(process.env.DATABASE_URL);const c=new pg.Client({connectionString:process.env.DATABASE_URL.replace('/ged_by_dz','/postgres')});await c.connect();const r=await c.query('SELECT 1 FROM pg_database WHERE datname = '+String.fromCharCode(39)+'ged_by_dz'+String.fromCharCode(39));if(!r.rowCount)await c.query('CREATE DATABASE ged_by_dz');await c.end();console.log('Base locale GED By DZ prête sur 127.0.0.1:55432.');"
if ($LASTEXITCODE -ne 0) { throw 'Impossible de préparer la base dédiée.' }
