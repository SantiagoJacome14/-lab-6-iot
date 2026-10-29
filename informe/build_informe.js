const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, ImageRun, PageBreak,
} = require("docx");

const REPO = process.env.REPO_URL || "(repositorio pendiente de publicar)";
const diagram = fs.readFileSync(path.join(__dirname, "diagrama_lab6.png"));
const GOLD = "B7862A", DARK = "1F2937";

const p = (t, o = {}) => new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: t, size: 20, ...o })] });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 90 }, children: [new TextRun({ text: t, bold: true, color: GOLD, size: 26 })] });
const bullet = (t) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [new TextRun({ text: t, size: 20 })] });

const cell = (t, w, o = {}) => new TableCell({
  width: { size: w, type: WidthType.DXA },
  shading: o.shade ? { type: ShadingType.CLEAR, fill: o.shade } : undefined,
  margins: { top: 60, bottom: 60, left: 90, right: 90 },
  children: [new Paragraph({ children: [new TextRun({ text: t, size: 18, bold: !!o.head, color: o.head ? "FFFFFF" : "000000" })] })],
});
function kvTable(rows, w1 = 2600, w2 = 6760) {
  return new Table({
    width: { size: w1 + w2, type: WidthType.DXA }, columnWidths: [w1, w2],
    rows: rows.map(([k, v]) => new TableRow({ children: [cell(k, w1, { head: true, shade: DARK }), cell(v, w2)] })),
  });
}

const PX = 96;
const dW = 6.5 * PX, dH = dW * (800 / 2000);
const EV = path.join(__dirname, "..", "evidencias");
const SIZES = JSON.parse(fs.readFileSync(path.join(__dirname, "_sizes.json"), "utf-8"));
function fit(w, h, maxWIn, maxHIn) {
  let width = maxWIn * PX, height = (h / w) * width;
  if (height > maxHIn * PX) { height = maxHIn * PX; width = (w / h) * height; }
  return { width: Math.round(width), height: Math.round(height) };
}
function figure(file, caption, maxH = 3.4) {
  const [w, h] = SIZES[file];
  return [
    new Paragraph({ keepNext: true, alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 }, children: [new ImageRun({ data: fs.readFileSync(path.join(EV, file)), type: "png", transformation: fit(w, h, 6.4, maxH) })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 140 }, children: [new TextRun({ text: caption, italics: true, size: 17, color: "475569" })] }),
  ];
}
function textBlock(title, file) {
  const lines = fs.readFileSync(path.join(EV, file), "utf-8").replace(/\r/g, "").split("\n");
  return [
    new Paragraph({ keepNext: true, spacing: { before: 120, after: 40 }, children: [new TextRun({ text: title, bold: true, size: 18 })] }),
    ...lines.map((l) => new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: l.length ? l : " ", font: "Consolas", size: 13 })] })),
  ];
}
function anexo() {
  return [
    new Paragraph({ children: [new PageBreak()] }),
    h1("Anexo — Evidencias"),
    p("Capturas y salidas reales del clúster (29 de octubre de 2026). Los mismos archivos están en evidencias/ del repositorio."),
    ...figure("01_wordpress_pagina_antes.png", "Evidencia 01. WordPress (57.156.32.36): página de prueba \"Prueba Lab 6 – persistencia\" publicada antes del reinicio."),
    ...figure("02_prestashop_producto_antes.png", "Evidencia 02. PrestaShop (68.211.132.86): \"Producto Lab 6\" (ID 20, 25.000,00 €) en el catálogo antes del reinicio."),
    ...figure("04_grafana_dashboard.png", "Evidencia 03. Grafana: pods Running de WordPress y PrestaShop, reinicios, CPU y memoria por pod; se distinguen los pods viejos y nuevos tras el reinicio.", 3.6),
    ...textBlock("Evidencia 04. 03_reinicios.txt (reinicio de los dos Deployments y verificación)", "03_reinicios.txt"),
    ...textBlock("Evidencia 05. 00_cluster.txt (clúster, pods, PVC y servicios)", "00_cluster.txt"),
  ];
}

const doc = new Document({
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 900, bottom: 900, left: 1440, right: 1440 } } },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: "LABORATORIO 6: MULTIPLATAFORMA EN AKS", bold: true, size: 30 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "WordPress y PrestaShop con su propia base de datos, y Grafana", italics: true, size: 22, color: "475569" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: "Dawer Stiven Patiño · Julian Mejia · Santiago Jacome", size: 19 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: "Repositorio: " + REPO, size: 19, color: "1D4ED8" })] }),

      h1("1. Los dos portales y sus bases de datos en el mismo AKS"),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new ImageRun({ data: diagram, type: "png", transformation: { width: Math.round(dW), height: Math.round(dH) } })] }),
      kvTable([
        ["Clúster", "AKS en Chile Central (la política de la suscripción solo permite 5 regiones), Kubernetes 1.36 (nodos v1.36.4), 2 nodos Standard_D2ds_v4 (2 vCPU, 8 GiB), nivel Free, creado con azd y el template sabbour/aks-app-template recortado"],
        ["WordPress", "Namespace wordpress. Imagen wordpress:6-apache (Deployment) + Service LoadBalancer (http://57.156.32.36). BD propia: MariaDB 10.11 con PVC de 5 Gi y Service ClusterIP wordpress-db. PVC adicional para wp-content."],
        ["PrestaShop", "Namespace prestashop. Imagen prestashop/prestashop:8.1 (Deployment) + Service LoadBalancer (http://68.211.132.86). BD propia y distinta: MariaDB 10.11 con PVC de 5 Gi y Service ClusterIP prestashop-db. PVC para /var/www/html."],
        ["Aislamiento", "Cada portal solo conoce el nombre DNS de su base (prestashop-db no es alcanzable por la configuración de WordPress y viceversa). Las bases son ClusterIP, sin IP pública. Credenciales en Secrets de Kubernetes generados al azar al desplegar; el repo solo trae ejemplos sin valores reales."],
      ]),

      h1("2. Persistencia tras reiniciar cada pod"),
      p("En WordPress se completó el asistente y se publicó la página \"Prueba Lab 6 – persistencia\". En PrestaShop se instaló la tienda y se creó el producto \"Producto Lab 6\" (25.000,00 €). Luego se ejecutó kubectl rollout restart en los dos Deployments (29-oct-2026, 05:57 UTC): los pods se recrearon con otro nombre (wordpress-66d967684-8qscg → wordpress-7b88d8658-lfq76; prestashop-6888856d8b-xjsfz → prestashop-6bd7fb85c7-954bq) y las bases de datos no se tocaron."),
      bullet("Después del reinicio, la página de WordPress respondió HTTP 200 con su título, y el producto de PrestaShop respondió HTTP 200 con su precio."),
      bullet("Las consultas directas a cada base confirman las mismas filas antes y después: la página (ID 6) en wp_posts y el producto (ID 20) en ps_product."),
      bullet("PrestaShop necesitó un detalle: su carpeta /var/www/html va en un PVC que un initContainer llena la primera vez; así, al reiniciar el pod la tienda ya está instalada y no se reinstala sobre la base."),

      h1("3. Qué se ve en Grafana"),
      p("El template trae Azure Managed Grafana, pero no se pudo usar: en esta suscripción de estudiante la única región permitida que ofrece Managed Grafana (France Central) no tiene cupo de vCPU para el clúster. La guía permite un Deployment propio, así que Grafana 12 y Prometheus (kube-state-metrics y cAdvisor) corren en el namespace monitoring, sin usar las bases de los portales. Se accede por kubectl port-forward (http://localhost:3000); el dashboard \"Lab 6 – WordPress y PrestaShop en AKS\" está provisionado por archivo."),
      bullet("Pods Running y Ready por portal (2 por namespace: aplicación y base de datos) y reinicios acumulados por contenedor."),
      bullet("CPU y memoria por pod, con el nombre del pod en la leyenda: tras el reinicio aparecen el pod nuevo y el anterior, de modo que se distinguen ambos portales y el cambio."),
      bullet("Tabla de estado de los pods de los dos namespaces."),

      h1("4. Apagado y costo"),
      kvTable([
        ["Decisión", "Dejar el entorno encendido solo hasta la entrega y la sustentación y luego ejecutar azd down --force --purge, que elimina el grupo de recursos rg-lab6 completo (clúster, registro, discos y direcciones IP). No es un clúster compartido, así que hay que apagarlo."],
        ["Costo estimado", "Aprox. 5 a 7 USD por día (2 nodos D2ds_v4 de pago por uso, discos, balanceadores e IP públicas), con tarifas públicas; el valor real se confirma en Azure Cost Management. El nivel Free del plano de control de AKS no cobra. Se usó crédito de Azure for Students."],
        ["Tiempo encendido", "Creado el 29-oct-2026 hacia las 03:15 UTC. La fecha de apagado se anota en el README tras ejecutar azd down."],
      ]),

      h1("5. Qué falló"),
      bullet("El template original está desactualizado (Kubernetes 1.26, 4 nodos DS4_v2, KEDA, ASO y un rol Contributor de suscripción): se recortó a 2 nodos pequeños, versión vigente y solo AKS + ACR."),
      bullet("La política de la suscripción rechazó eastus2 (RequestDisallowedByAzure): solo se permiten francecentral, chilecentral, spaincentral, mexicocentral y northcentralus."),
      bullet("France Central tenía 0 vCPU de cuota de la familia elegida y B2as_v2 no estaba permitido para AKS; Chile Central con D2ds_v4 funcionó. North Central US tenía 4 de 6 vCPU ocupadas por las máquinas del Lab 5."),
      bullet("El admin de PrestaShop devolvía al login: ligaba la sesión a la IP del cliente y el tráfico llegaba con la IP de cada nodo. Se arregló con externalTrafficPolicy: Local en el Service."),
      bullet("Grafana no obtuvo IP pública por el límite de 3 IP por región (PublicIPCountLimitReached): se dejó como ClusterIP y se accede con port-forward."),

      h1("6. Entregables"),
      p("Repositorio " + REPO + ": infra/ y azure.yaml (AKS + ACR), k8s/wordpress, k8s/prestashop y k8s/monitoring (manifiestos y Secrets de ejemplo sin valores reales), scripts/desplegar.ps1, README con el despliegue completo y evidencias/ (los dos sitios, reinicios, clúster y Grafana). Las evidencias se adjuntan al final como Anexo."),
      ...anexo(),
    ],
  }],
});

Packer.toBuffer(doc).then((b) => { fs.writeFileSync(path.join(__dirname, "Laboratorio 6 - Informe.docx"), b); console.log("done"); });
