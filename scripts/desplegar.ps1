# Despliega WordPress + PrestaShop (y sus dos bases de datos) y Prometheus + Grafana en el AKS aprovisionado con "azd provision".
# Uso (PowerShell, en la raiz del repo):   .\scripts\desplegar.ps1
# Las contrasenas se generan al azar, viven SOLO en Secrets del cluster y en .secrets.local.txt (git-ignored).
# (Archivo solo ASCII a proposito: PowerShell 5.1 lee mal los acentos sin BOM.)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

function Nueva-Clave { -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 20 | ForEach-Object { [char]$_ }) }
# kubectl escribe "NotFound" en stderr; en PS 5.1 con Stop eso aborta, asi que estas consultas bajan el modo de error.
function Q { $old = $ErrorActionPreference; $ErrorActionPreference = "Continue"; try { (& kubectl @args 2>$null) } finally { $ErrorActionPreference = $old } }
function K { & kubectl @args; if ($LASTEXITCODE -ne 0) { throw "kubectl $($args -join ' ') fallo" } }

# 1. Credenciales del cluster (nombre y resource group los guarda azd)
$envName = (azd env get-value AZURE_ENV_NAME)
$rg  = (azd env get-value AZURE_RESOURCE_GROUP)
$aks = (azd env get-value AZURE_AKS_CLUSTER_NAME)
$ErrorActionPreference = "Continue"; az aks get-credentials -g $rg -n $aks --overwrite-existing 2>$null | Out-Null; $ErrorActionPreference = "Stop"
K get nodes

# 2. Namespaces
K apply -f k8s/wordpress/00-namespace.yaml
K apply -f k8s/prestashop/00-namespace.yaml

# 3. Secrets (solo si no existen; no se pisan al repetir el script)
$clave = @{}
if (-not (Q -n wordpress get secret wordpress-db -o name)) {
    $clave.wpRoot = Nueva-Clave; $clave.wp = Nueva-Clave
    K -n wordpress create secret generic wordpress-db `
        "--from-literal=MARIADB_ROOT_PASSWORD=$($clave.wpRoot)" "--from-literal=MARIADB_DATABASE=wordpress" `
        "--from-literal=MARIADB_USER=wp_user" "--from-literal=MARIADB_PASSWORD=$($clave.wp)"
}
if (-not (Q -n prestashop get secret prestashop-db -o name)) {
    $clave.psRoot = Nueva-Clave; $clave.ps = Nueva-Clave; $clave.psAdmin = Nueva-Clave
    K -n prestashop create secret generic prestashop-db `
        "--from-literal=MARIADB_ROOT_PASSWORD=$($clave.psRoot)" "--from-literal=MARIADB_DATABASE=prestashop" `
        "--from-literal=MARIADB_USER=ps_user" "--from-literal=MARIADB_PASSWORD=$($clave.ps)"
    K -n prestashop create secret generic prestashop-admin `
        "--from-literal=ADMIN_MAIL=admin@lab6.local" "--from-literal=ADMIN_PASSWD=$($clave.psAdmin)"
}
if ($clave.Count -gt 0) {
    $lineas = @("# Claves generadas $(Get-Date -Format s) - NO subir a git")
    foreach ($k in $clave.Keys) { $lineas += "$k=$($clave[$k])" }
    $lineas += "prestashop_admin_mail=admin@lab6.local"
    $lineas | Add-Content -Path .secrets.local.txt -Encoding ASCII
}

# 4. Bases de datos (una por portal)
K apply -f k8s/wordpress/02-db.yaml
K apply -f k8s/prestashop/02-db.yaml
K -n wordpress rollout status deploy/wordpress-db --timeout=300s
K -n prestashop rollout status deploy/prestashop-db --timeout=300s

# 5. WordPress
K apply -f k8s/wordpress/03-app.yaml

# 6. PrestaShop: primero el Service para conocer la IP publica, despues el ConfigMap y el Deployment
K apply -f k8s/prestashop/04-service.yaml
Write-Host "Esperando IP publica de PrestaShop..."
$ip = ""
for ($i = 0; $i -lt 60 -and -not $ip; $i++) {
    $ip = Q -n prestashop get svc prestashop -o jsonpath="{.status.loadBalancer.ingress[0].ip}"
    if (-not $ip) { Start-Sleep 5 }
}
if (-not $ip) { throw "El Service de PrestaShop no obtuvo IP publica" }
K -n prestashop create configmap prestashop-site "--from-literal=PS_DOMAIN=$ip" --dry-run=client -o yaml | kubectl apply -f -
K apply -f k8s/prestashop/03-app.yaml

K -n wordpress rollout status deploy/wordpress --timeout=300s
K -n prestashop rollout status deploy/prestashop --timeout=600s

# 7. Monitoreo: Prometheus + Grafana propios (Helm) en el namespace monitoring
K create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
if (-not (Q -n monitoring get secret grafana-admin -o name)) {
    $gp = Nueva-Clave
    K -n monitoring create secret generic grafana-admin "--from-literal=admin-user=admin" "--from-literal=admin-password=$gp"
    Add-Content -Path .secrets.local.txt -Value "grafana_admin_password=$gp" -Encoding ASCII
}
$ErrorActionPreference = "Continue"
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts 2>$null | Out-Null
helm repo add grafana https://grafana.github.io/helm-charts 2>$null | Out-Null
helm repo update 2>$null | Out-Null
helm upgrade --install prometheus prometheus-community/prometheus -n monitoring -f k8s/monitoring/prometheus-values.yaml --wait --timeout 10m
if ($LASTEXITCODE -ne 0) { throw "helm prometheus fallo" }
K -n monitoring create configmap dashboard-portales --from-file=dashboard-portales.json=k8s/monitoring/dashboard-portales.json --dry-run=client -o yaml | kubectl apply -f -
K -n monitoring label configmap dashboard-portales grafana_dashboard=1 --overwrite
helm upgrade --install grafana grafana/grafana -n monitoring -f k8s/monitoring/grafana-values.yaml --wait --timeout 10m
if ($LASTEXITCODE -ne 0) { throw "helm grafana fallo" }

Write-Host ""
K get "pods,pvc,svc" -n wordpress
K get "pods,pvc,svc" -n prestashop
$wp = kubectl -n wordpress get svc wordpress -o jsonpath="{.status.loadBalancer.ingress[0].ip}"
Write-Host "WordPress:  http://$wp/"
Write-Host "PrestaShop: http://$ip/   (admin en http://$ip/admin_lab6 ; clave en .secrets.local.txt)"
K get "pods,svc" -n monitoring
$gf = ""
for ($i = 0; $i -lt 60 -and -not $gf; $i++) {
    $gf = Q -n monitoring get svc grafana -o jsonpath="{.status.loadBalancer.ingress[0].ip}"
    if (-not $gf) { Start-Sleep 5 }
}
Write-Host "Grafana:    http://$gf/   (usuario admin; clave en .secrets.local.txt) -> dashboard 'Lab 6 - WordPress y PrestaShop en AKS'"
