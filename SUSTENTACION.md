# Guion de sustentación - Laboratorio 6 (aprox. 4-5 minutos)

## 1. Qué hicimos (30 s)
"Montamos un solo clúster de Azure Kubernetes Service con dos portales distintos, WordPress y PrestaShop. Cada uno
tiene su propia base de datos MariaDB, y Grafana observa el clúster desde aparte. Todo está como código: Bicep para el
clúster y manifiestos YAML para los portales, y un script que lo despliega de principio a fin."

## 2. Arquitectura (1 min)
- "El clúster está en Chile Central, con Kubernetes 1.36 y dos nodos D2ds_v4. Lo creamos con `azd provision` usando el
  template de sabbour, pero lo recortamos: el original pedía cuatro nodos enormes y servicios que no necesitábamos."
- "Cada portal vive en su namespace: `wordpress` y `prestashop`. Cada uno tiene un Deployment de la aplicación con un
  Service LoadBalancer, y su base de datos con un PVC de 5 Gi y un Service ClusterIP."
- "Las bases son ClusterIP, así que ninguna tiene IP pública. Las contraseñas están en Secrets de Kubernetes, generados
  al azar al desplegar; en el repo solo hay ejemplos sin valores reales."
- "WordPress no conoce la base de PrestaShop ni al revés: cada aplicación solo sabe el nombre DNS de su propia base."

## 3. Demostración de persistencia (1 min)
- "En WordPress creamos la página 'Prueba Lab 6 - persistencia'. En PrestaShop creamos el 'Producto Lab 6' a 25.000."
- "Ejecutamos `kubectl rollout restart` en los dos Deployments. Los pods se recrearon con otro nombre y las bases no se
  tocaron. Después del reinicio la página y el producto siguen ahí, y además lo comprobamos con consultas directas a las
  dos bases: las mismas filas antes y después. Eso está en `evidencias/03_reinicios.txt`."
- "En PrestaShop hubo un detalle: su carpeta `/var/www/html` va en un PVC y un initContainer lo llena la primera vez;
  si no, al reiniciar el pod intentaría reinstalar la tienda sobre una base que ya existe."

## 4. Grafana (45 s)
"El template trae Azure Managed Grafana, pero no pudimos usarlo: la política de la suscripción de estudiante solo permite
cinco regiones, y la única con Managed Grafana (France Central) no tenía cupo de vCPU. La guía permite un Deployment
propio, así que desplegamos Prometheus y Grafana con Helm en el namespace `monitoring`. El dashboard muestra los pods
Running y Ready de cada portal, los reinicios, y CPU y memoria por pod. Se ven los pods viejos y los nuevos después del
reinicio."

## 5. Qué falló y cómo lo resolvimos (1 min)
- "Azure rechazó la región eastus2 por política (`RequestDisallowedByAzure`); había solo cinco regiones permitidas."
- "En France Central la cuota de la familia de máquinas era cero. Probamos Chile Central con D2ds_v4 y funcionó."
- "El admin de PrestaShop nos devolvía al login: ata la sesión a la IP del cliente y el tráfico llegaba con la IP de cada
  nodo. Lo arreglamos con `externalTrafficPolicy: Local` en el Service."
- "Grafana no consiguió IP pública porque el límite es de tres por región; lo dejamos como ClusterIP y entramos con
  `kubectl port-forward`, que además es más seguro."

## 6. Apagado y costo (30 s)
"No es un clúster compartido, así que lo apagamos con `azd down --force --purge`, que borra todo el grupo de recursos
`rg-lab6`. Estuvo encendido unas horas; el costo estimado era de 5 a 7 USD por día con tarifas públicas, y el valor real
se confirma en Azure Cost Management."

## Preguntas probables
- **¿Por qué dos bases y no una compartida?** Aislamiento: un fallo, una migración o una contraseña filtrada en un portal
  no afecta al otro; además es lo que pide la guía.
- **¿Por qué `Recreate` y no `RollingUpdate`?** Un PVC `ReadWriteOnce` (disco de Azure) solo se monta en un pod a la vez;
  con RollingUpdate el pod nuevo quedaría esperando el disco del viejo.
- **¿Dónde está la persistencia?** En los PVC `managed-csi` (discos de Azure): sobreviven a la muerte del pod.
- **¿Qué pasa si se borra el PVC?** Se pierden los datos; por eso la base y los archivos tienen volumen propio.
- **¿Por qué las contraseñas no están en el repo?** Se generan al desplegar y viven solo en Secrets del clúster y en un
  archivo local ignorado por git.
- **¿Por qué el producto sale sin stock?** Se creó con cantidad 0; no afecta a la prueba de persistencia.
