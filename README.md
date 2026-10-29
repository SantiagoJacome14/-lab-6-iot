# Laboratorio 6 - Multiplataforma en AKS (WordPress + PrestaShop + Grafana)

Un solo cluster Azure Kubernetes Service hospeda dos portales independientes, cada uno con su propia base de datos.
Grafana (Azure Managed Grafana) observa el cluster desde fuera de los sitios.

```
                       Internet
                  +-------+--------+
        LoadBalancer :80        LoadBalancer :80
                  |                |
  ns wordpress    v                v     ns prestashop
 +-------------------------+  +----------------------------+
 | Deployment wordpress    |  | Deployment prestashop      |
 | PVC wp-content          |  | PVC /var/www/html          |
 +------------+------------+  +-------------+--------------+
              | ClusterIP 3306              | ClusterIP 3306
 +------------v------------+  +-------------v--------------+
 | MariaDB wordpress-db    |  | MariaDB prestashop-db      |
 | PVC 5Gi  + Secret       |  | PVC 5Gi  + Secret          |
 +-------------------------+  +----------------------------+

   Azure Managed Grafana + Azure Monitor (Prometheus)  ->  lee el cluster completo
```

## Estructura

| Ruta | Contenido |
|---|---|
| `infra/`, `azure.yaml` | Template `sabbour/aks-app-template` recortado: AKS + ACR + Managed Grafana + Prometheus |
| `k8s/wordpress/` | Namespace, Secret de ejemplo, BD (PVC + Deployment + Service ClusterIP), app (PVC + Deployment + Service LoadBalancer) |
| `k8s/prestashop/` | Igual, con su propia BD |
| `scripts/desplegar.ps1` | Crea Secrets aleatorios y aplica todo en orden |
| `evidencias/` | Capturas y salidas reales (sitios, reinicios, Grafana) |
| `informe/` | Informe en PDF |

## Cambios al template (y por que)

El template original esta desactualizado para una cuenta Azure for Students (cuota de 6 vCPU por region):
Kubernetes 1.26 (ya no existe), 4 nodos `Standard_DS4_v2`, KEDA, Azure Service Operator y un rol Contributor a nivel
de suscripcion. Se dejo: AKS (2 nodos `Standard_B2as_v2`, Kubernetes 1.36.5, `francecentral`), ACR, Managed Grafana,
Azure Monitor Prometheus y Container Insights. Se quitaron: KEDA, ASO, identidades extra y los hooks.

## Despliegue

Requisitos: Azure CLI, azd y kubectl; `az login`.

```powershell
azd env new lab6 --location francecentral
azd provision            # AKS + Grafana (10-15 min)
.\scripts\desplegar.ps1  # BDs + WordPress + PrestaShop
```

El script genera contrasenas aleatorias, las guarda solo como Secrets del cluster y en `.secrets.local.txt`
(ignorado por git). Los archivos `01-secret.example.yaml` son ejemplos sin valores reales.

Detalle de PrestaShop: su instalador automatico necesita saber la IP publica (`PS_DOMAIN`), por eso el script crea
primero el Service, espera la IP y luego aplica el Deployment. `/var/www/html` va en un PVC que un initContainer llena
con los archivos de la imagen la primera vez; asi, tras reiniciar el pod la tienda ya esta instalada.

## Prueba de persistencia

```powershell
kubectl -n wordpress rollout restart deploy/wordpress
kubectl -n prestashop rollout restart deploy/prestashop
```

La pagina creada en WordPress y el producto creado en PrestaShop siguen ahi (viven en sus bases de datos).

## Grafana

`kubectl -n monitoring port-forward svc/grafana 3000:80` y abrir http://localhost:3000 (usuario `admin`, clave en `.secrets.local.txt`). Dashboard: *Kubernetes / Compute Resources / Namespace (Pods)*
filtrando `wordpress` y `prestashop`.

## Apagado

```powershell
azd down --force --purge
```

Elimina el resource group completo (cluster, ACR, Grafana, discos). Costo aproximado mientras corre: 4-6 USD/dia.

