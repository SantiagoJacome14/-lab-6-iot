from PIL import Image, ImageDraw, ImageFont
import os

W, H = 2000, 800
BG, BOX, TEXT, SUB = (13, 17, 23), (30, 41, 59), (241, 245, 249), (148, 163, 184)
GOLD, CYAN, GREEN, PURPLE, RED = (250, 204, 21), (56, 189, 248), (34, 197, 94), (168, 85, 247), (239, 68, 68)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)


def font(size, bold=False):
    try:
        return ImageFont.truetype("segoeuib.ttf" if bold else "segoeui.ttf", size)
    except Exception:
        return ImageFont.load_default()


f_title, f_ns, f_name, f_sub, f_lbl = font(34, True), font(26, True), font(22, True), font(16), font(15, True)
d.text((W / 2, 36), "Lab 6 — WordPress + PrestaShop, cada uno con su BD, en un solo AKS (Chile Central)", font=f_title, fill=TEXT, anchor="mm")


def box(x0, y0, x1, y1, name, sub, color):
    d.rounded_rectangle([x0, y0, x1, y1], radius=12, fill=BOX, outline=color, width=3)
    d.text(((x0 + x1) / 2, y0 + 30), name, font=f_name, fill=TEXT, anchor="mm")
    for k, line in enumerate(sub.split("\n")):
        d.text(((x0 + x1) / 2, y0 + 62 + k * 22), line, font=f_sub, fill=SUB, anchor="mm")


def arrow(x0, y0, x1, y1, color, label=None):
    d.line([x0, y0, x1, y1], fill=color, width=4)
    if x1 != x0:
        s = 1 if x1 > x0 else -1
        d.polygon([(x1, y1), (x1 - s * 16, y1 - 8), (x1 - s * 16, y1 + 8)], fill=color)
    else:
        s = 1 if y1 > y0 else -1
        d.polygon([(x1, y1), (x1 - 8, y1 - s * 16), (x1 + 8, y1 - s * 16)], fill=color)
    if label:
        d.text(((x0 + x1) / 2 + 70, (y0 + y1) / 2), label, font=f_lbl, fill=color, anchor="mm")


# Clúster
d.rounded_rectangle([30, 80, W - 30, 780], radius=18, outline=(71, 85, 105), width=3)
d.text((55, 100), "AKS · Kubernetes 1.36 · 2 nodos Standard_D2ds_v4 · rg-lab6", font=f_ns, fill=SUB, anchor="lm")

# Dos portales
for i, (ns, app, color, dbn, url) in enumerate([
    ("namespace wordpress", "WordPress 6\nDeployment + PVC wp-content", CYAN, "wordpress-db", "57.156.32.36"),
    ("namespace prestashop", "PrestaShop 8.1\nDeployment + PVC /var/www/html", GOLD, "prestashop-db", "68.211.132.86"),
]):
    y0 = 150 + i * 255
    d.rounded_rectangle([60, y0, 1280, y0 + 240], radius=14, outline=color, width=3)
    d.text((80, y0 + 26), ns, font=f_ns, fill=color, anchor="lm")
    d.text((80, y0 + 205), "Internet", font=f_sub, fill=SUB, anchor="lm")
    box(90, y0 + 60, 340, y0 + 175, "LoadBalancer :80", url, color)
    box(420, y0 + 60, 720, y0 + 175, "Pod " + ns.split()[1], app, color)
    box(800, y0 + 60, 1010, y0 + 175, "Service ClusterIP", dbn + ":3306", GREEN)
    box(1060, y0 + 60, 1260, y0 + 175, "Pod MariaDB", "10.11 · PVC + Secret", GREEN)
    arrow(340, y0 + 117, 420, y0 + 117, color)
    arrow(720, y0 + 117, 800, y0 + 117, GREEN)
    arrow(1010, y0 + 117, 1060, y0 + 117, GREEN)

# Monitoreo
d.rounded_rectangle([1340, 150, W - 60, 640], radius=14, outline=PURPLE, width=3)
d.text((1360, 176), "namespace monitoring", font=f_ns, fill=PURPLE, anchor="lm")
box(1380, 220, 1900, 330, "Prometheus", "kube-state-metrics + cAdvisor\ncada 30 s", PURPLE)
box(1380, 400, 1900, 510, "Grafana 12", "dashboard: pods de los 2 portales\nport-forward :3000", PURPLE)
arrow(1640, 400, 1640, 330, PURPLE, "consulta PromQL")
d.text((1640, 570), "Observa los 2 namespaces", font=f_sub, fill=TEXT, anchor="mm")
d.text((1640, 596), "pero no usa sus bases de datos", font=f_sub, fill=SUB, anchor="mm")

d.text((60, 700), "Cada portal tiene SU base: WordPress no ve prestashop-db ni al revés (namespaces y Secrets separados).", font=f_sub, fill=SUB, anchor="lm")
d.text((60, 728), "Los Service de BD son ClusterIP: ninguna base de datos tiene IP pública. Credenciales solo en Secrets (no en el repo).", font=f_sub, fill=SUB, anchor="lm")
d.text((60, 756), "Persistencia: PVC managed-csi (disco Azure) para cada BD y para los archivos de cada portal.", font=f_sub, fill=SUB, anchor="lm")

img.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), "diagrama_lab6.png"))
print("ok")
