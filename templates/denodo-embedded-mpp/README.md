# Denodo Lakehouse Accelerator Cloud Templates

The **Denodo Lakehouse Accelerator Cloud Templates** project includes sample templates for deploying the Denodo Lakehouse Accelerator in Azure using ARM or in AWS using CloudFormation.

## Deploying Denodo Lakehouse Accelerator in AWS Using CloudFormation

Cloud Formation templates (for AWS resource creation): 
* [MppClusterOnlyStack](./MppClusterOnlyStack.template.json)
* [MppClusterOnlyStack-with-network](./MppClusterOnlyStack-with-network.template.json)

These templates allow you to select different configuration parameters and it will automatically provision all the cloud resources needed for deploying Denodo Embedded MPP in AWS. 

We encourage you to follow the step-by-step instructions included in the [Deploying Denodo Lakehouse Accelerator in AWS Using CloudFormation](https://community.denodo.com/kb/en/view/document/Deploying%20Denodo%20Lakehouse%20Accelerator%20in%20AWS%20Using%20CloudFormation)  Knowledge-Base article for deploying Denodo Lakehouse Accelerator in AWS using these templates.

## Deploying Denodo Lakehouse Accelerator in Azure Using ARM Templates

ARM Template (for Azure resource creation): 
* [AzureEmbeddedMpp](./AzureEmbeddedMpp.json)

This template allows you to select different configuration parameters and it will automatically provision all the cloud resources needed for deploying Denodo Embedded MPP in Azure. 

We encourage you to follow the step-by-step instructions included in the [Deploying Denodo Lakehouse Accelerator in Azure Using ARM Templates](https://community.denodo.com/kb/en/view/document/Deploying%20Denodo%20Lakehouse%20Accelerator%20in%20Azure%20Using%20ARM%20Templates)  Knowledge-Base article for deploying Denodo Lakehouse Accelerator in Azure using this JSON ARM template.