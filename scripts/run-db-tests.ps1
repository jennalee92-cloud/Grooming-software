# Runs the pgTAP tests in supabase/tests/database against the linked
# Supabase project WITHOUT Docker, and keeps no test data.
#
# How it works: each test file is wrapped so every assertion's result is
# captured, then the script ends by raising an error that carries the
# summary. Raising the error aborts the transaction, so every fixture row
# (test users, salons, audit events) is rolled back.
#
# Usage (from the repo root):  .\scripts\run-db-tests.ps1
# The Supabase CLI asks for confirmation before touching a hosted project;
# pass -Yes to confirm up front.

param([switch]$Yes)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$tmp = Join-Path ([IO.Path]::GetTempPath()) "grooming-desk-db-tests"
New-Item -ItemType Directory -Force $tmp | Out-Null
$utf8 = New-Object Text.UTF8Encoding $false
$failed = $false

$tail = @'

do $tap$
declare r text;
begin
  select format('%s of %s passed. Failures: %s',
                count(*) filter (where line like 'ok %'),
                count(*),
                coalesce(string_agg(line, ' || ' order by n) filter (where line not like 'ok %'), 'none'))
    into r from tap_out;
  raise exception 'TAP RESULTS (rolled back) %', r;
end $tap$;
'@

Get-ChildItem (Join-Path $root 'supabase\tests\database') -Filter '*.test.sql' | Sort-Object Name | ForEach-Object {
  $src = Get-Content $_.FullName -Raw
  $body = $src -replace '(?s)select \* from finish\(\);\s*rollback;\s*$', ''
  $body = $body -replace '(?m)^select plan\((\d+)\);', "select plan(`$1);`ncreate temp table tap_out (n serial, line text);`ngrant all on tap_out to authenticated, anon;`ngrant all on sequence tap_out_n_seq to authenticated, anon;"
  $body = $body -replace '(?m)^select (is|isnt|ok|lives_ok|throws_ok|results_eq|set_eq|bag_eq)\(', 'insert into tap_out(line) select $1('
  $runner = Join-Path $tmp $_.Name
  [IO.File]::WriteAllText($runner, $body + $tail, $utf8)

  $cliArgs = @('supabase', 'db', 'query', '--remote', '-f', $runner)
  if ($Yes) { $cliArgs += '--yes' }
  # The CLI writes status lines to stderr; don't treat those as failures.
  $ErrorActionPreference = 'Continue'
  $out = ('' | & npx @cliArgs 2>&1 | Out-String)
  $ErrorActionPreference = 'Stop'

  if ($out -match 'TAP RESULTS \(rolled back\) (\d+) of (\d+) passed\. Failures: (.*?)(\\n|CONTEXT|")') {
    $summary = "$($Matches[1]) of $($Matches[2]) passed"
    if ($Matches[1] -ne $Matches[2]) { $failed = $true; Write-Host "FAIL $($_.Name): $summary. $($Matches[3])" -ForegroundColor Red }
    else { Write-Host "PASS $($_.Name): $summary" -ForegroundColor Green }
  } else {
    $failed = $true
    Write-Host "ERROR $($_.Name): test file did not finish" -ForegroundColor Red
    Write-Host $out
  }
}

if ($failed) { exit 1 }
