$ErrorActionPreference = 'Stop'

$env:FIREBASE_PROJECT_ID = 'demo-super-pos'
$env:FIREBASE_DATABASE_URL = 'http://127.0.0.1:19000?ns=demo-super-pos'
if (-not $env:BOOTSTRAP_ADMIN_USERNAME) {
  $env:BOOTSTRAP_ADMIN_USERNAME = 'Demo Admin'
}
if (-not $env:BOOTSTRAP_ADMIN_PASSWORD) {
  $env:BOOTSTRAP_ADMIN_PASSWORD = 'DemoAdmin123!'
}
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:19099'
$env:FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:19000'
$env:E2E_FIREBASE_TEST_ADMIN = $env:BOOTSTRAP_ADMIN_USERNAME
$env:E2E_FIREBASE_TEST_PASSWORD = $env:BOOTSTRAP_ADMIN_PASSWORD
Remove-Item Env:E2E_BASE_URL -ErrorAction SilentlyContinue

firebase emulators:exec --project demo-super-pos --only auth,database "npm run test:firebase:browser"
$result = $LASTEXITCODE
foreach ($port in @(19000, 19099)) {
  $connections = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    $process = Get-CimInstance Win32_Process -Filter "processId = $($connection.OwningProcess)" -ErrorAction SilentlyContinue
    if ($process -and $process.CommandLine -match 'firebase.*emulator|emulator.*jar') {
      Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  }
}
exit $result
