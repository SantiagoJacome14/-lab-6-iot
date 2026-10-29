"""Genera k8s/monitoring/dashboard-portales.json (dashboard de Grafana: pods de WordPress y PrestaShop)."""
import json, os

NS = 'namespace=~"wordpress|prestashop"'
DS = {"type": "prometheus", "uid": "prometheus-lab6"}


def panel(pid, title, kind, x, y, w, h, exprs, legend, unit=None, desc=None):
    p = {
        "id": pid, "title": title, "type": kind, "datasource": DS,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "targets": [{"refId": chr(65 + i), "expr": e, "legendFormat": legend, "datasource": DS,
                     "instant": kind in ("stat", "table")} for i, e in enumerate(exprs)],
        "fieldConfig": {"defaults": {"unit": unit} if unit else {}, "overrides": []},
        "options": {},
    }
    if desc:
        p["description"] = desc
    if kind == "timeseries":
        p["options"] = {"legend": {"displayMode": "table", "placement": "bottom", "calcs": ["lastNotNull"]}}
    if kind == "stat":
        p["options"] = {"reduceOptions": {"calcs": ["lastNotNull"]}, "colorMode": "value", "graphMode": "none"}
        p["fieldConfig"]["defaults"]["color"] = {"mode": "thresholds"}
        p["fieldConfig"]["defaults"]["thresholds"] = {"mode": "absolute", "steps": [{"color": "green", "value": None}]}
    return p


panels = [
    panel(1, "Pods Running - WordPress", "stat", 0, 0, 6, 4,
          ['sum(kube_pod_status_phase{namespace="wordpress",phase="Running"})'], "wordpress"),
    panel(2, "Pods Running - PrestaShop", "stat", 6, 0, 6, 4,
          ['sum(kube_pod_status_phase{namespace="prestashop",phase="Running"})'], "prestashop"),
    panel(3, "Reinicios de contenedores (acumulado)", "stat", 12, 0, 6, 4,
          [f'sum by (namespace) (kube_pod_container_status_restarts_total{{{NS}}})'], "{{namespace}}"),
    panel(4, "Pods Ready", "stat", 18, 0, 6, 4,
          [f'sum by (namespace) (kube_pod_status_ready{{{NS},condition="true"}})'], "{{namespace}}"),
    panel(5, "CPU por pod (cores)", "timeseries", 0, 4, 12, 9,
          [f'sum by (namespace, pod) (rate(container_cpu_usage_seconds_total{{{NS},container!=""}}[5m]))'],
          "{{namespace}} / {{pod}}", "short"),
    panel(6, "Memoria por pod", "timeseries", 12, 4, 12, 9,
          [f'sum by (namespace, pod) (container_memory_working_set_bytes{{{NS},container!=""}})'],
          "{{namespace}} / {{pod}}", "bytes"),
    panel(7, "Pods de los dos portales (estado)", "table", 0, 13, 24, 8,
          [f'max by (namespace, pod, phase) (kube_pod_status_phase{{{NS}}} == 1)'], ""),
]

dash = {
    "uid": "lab6-portales", "title": "Lab 6 - WordPress y PrestaShop en AKS", "schemaVersion": 39, "version": 1,
    "tags": ["lab6"], "timezone": "browser", "refresh": "30s", "time": {"from": "now-1h", "to": "now"},
    "panels": panels,
}
out = os.path.join(os.path.dirname(__file__), "..", "k8s", "monitoring", "dashboard-portales.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump(dash, f, indent=1, ensure_ascii=False)
print("ok", out)
