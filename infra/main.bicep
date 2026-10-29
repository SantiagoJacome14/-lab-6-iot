// Basado en sabbour/aks-app-template, recortado para Azure for Students (cuota de 6 vCPU):
// sin KEDA / ASO / Contributor a nivel de suscripcion / Managed Grafana (ver README), un solo node pool pequeno.
targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Nombre del entorno azd; prefija el resource group y genera un hash corto.')
param environmentName string

@minLength(1)
@description('Region principal')
param location string

@description('Version de Kubernetes')
param kubernetesVersion string = '1.36'

@description('Tamano de los nodos')
param nodeVmSize string = 'Standard_D2ds_v4'

@description('Cantidad de nodos')
param nodeCount int = 2

var abbrs = loadJsonContent('./abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = { 'azd-env-name': environmentName }

resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: '${abbrs.resourcesResourceGroups}${environmentName}'
  location: location
  tags: tags
}

module acr './resources/acr.bicep' = {
  name: 'container-registry'
  scope: resourceGroup
  params: {
    location: location
    name: '${abbrs.containerRegistryRegistries}${resourceToken}'
    tags: tags
  }
}

module aks './resources/aks.bicep' = {
  name: 'aks'
  scope: resourceGroup
  params: {
    location: location
    name: '${abbrs.containerServiceManagedClusters}${resourceToken}'
    kubernetesVersion: kubernetesVersion
    nodeVmSize: nodeVmSize
    nodeCount: nodeCount
    tags: tags
  }
}

module containerRegistryAccess './role-assignments/aks-acr-role-assignment.bicep' = {
  name: 'cluster-container-registry-access'
  scope: resourceGroup
  params: {
    aksPrincipalId: aks.outputs.clusterIdentity.objectId
    acrName: acr.outputs.name
    desc: 'AKS cluster managed identity'
  }
}

output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = tenant().tenantId
output AZURE_SUBSCRIPTION_ID string = subscription().subscriptionId
output AZURE_AKS_CLUSTER_NAME string = aks.outputs.name
output AZURE_RESOURCE_GROUP string = resourceGroup.name

