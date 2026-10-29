param name string
param location string
param kubernetesVersion string
param nodeVmSize string
param nodeCount int

@description('Custom tags to apply to the resources')
param tags object = {}




resource aks 'Microsoft.ContainerService/managedClusters@2024-09-01' = {
  location: location
  name: name
  properties: {
    dnsPrefix: '${name}-dns'
    kubernetesVersion: kubernetesVersion
    enableRBAC: true
    agentPoolProfiles: [
      {
        name: 'systempool'
        osDiskSizeGB: 64
        osDiskType: 'Managed'
        count: nodeCount
        vmSize: nodeVmSize
        osType: 'Linux'
        type: 'VirtualMachineScaleSets'
        mode: 'System'
        maxPods: 110
        enableNodePublicIP: false
        tags: tags
      }
    ]
    networkProfile: {
      loadBalancerSku: 'standard'
      networkPlugin: 'azure'
      networkPluginMode: 'overlay'
      outboundType: 'loadBalancer'
    }
    oidcIssuerProfile: {
      enabled: true
    }
    securityProfile: {
      workloadIdentity: {
        enabled: true
      }
    }
  }
  tags: tags
  sku: {
    name: 'Base'
    tier: 'Free'
  }
  identity: {
    type: 'SystemAssigned'
  }
}

@description('The AKS cluster identity')
output clusterIdentity object = {
  clientId: aks.properties.identityProfile.kubeletidentity.clientId
  objectId: aks.properties.identityProfile.kubeletidentity.objectId
  resourceId: aks.properties.identityProfile.kubeletidentity.resourceId
}
output name string = aks.name
