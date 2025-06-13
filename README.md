<!--
title: 'Denodo Community Resources'
description: 'This project maintains some utilities that any user can use as a base for her own Denodo projects.
layout: Doc
authorLink: ''
authorName: 'Denodo Community'
authorAvatar: ''
collaborators:
-->

# Denodo Community Resources

[Denodo](https://www.denodo.com/) is the leading logical data management platform. It establishes a unified data accessibility framework that provides data consumers with real-time insights from diverse data sources.

This project mantains some utilities that any user can use as a base for her own Denodo projects.

## Getting started

To get started, you’ll need to grab the code. If you are familiar with Git, just open a command prompt and execute this command:

```bash
git clone https://github.com/denodo/denodocommunity-resources.git
```
\* Please read the documentation of each subproject to get more information. 

### Clone a Single Project

This repository includes different projects. If you don't want to clone/download the entire repository to save disk space in your machine, you can download a specific subproject by executing these commands:

```bash
git clone  --no-checkout https://github.com/denodo/denodocommunity-resources.git
cd denodocommunity-resources
git sparse-checkout init
git sparse-checkout set <project_folder_name>
```
For example, for cloning the **Denodo AI PowerBI Widget**, execute:
```bash
git clone  --no-checkout https://github.com/denodo/denodocommunity-resources.git
cd denodocommunity-resources
git sparse-checkout init
git sparse-checkout set plugins/denodo-powerbi-ai-chart
```

## List of Projects included in this Repository

### Denodo Custom Components

In these subprojects you can find samples of custom components using the Denodo Java API:

* [Custom Functions](./custom-functions/): sample Virtual DataPort custom functions .
* [Custom Stored Procedures](./custom-stored-procedures/): sample Virtual DataPort tored procedures.

### Plugins

In this subproject you can find plugins for third-party applications that are connected to the Denodo Platform:

* [Denodo AI PowerBI Widget](./plugins/denodo-powerbi-ai-chart/): sample PowerBI widget that communicates with the Denodo AI SDK.
  
### Tools

In this subproject you can find useful applications that can be connected to Denodo Platform components:

* [Denodo AI SDK Evaluator](./tools/denodo-aisdk-evaluator/): this is a specialized tool for assessing the performance and accuracy of queries generated using the Denodo AI SDK.
  
### Scripts

In this subproject you can find useful scripts for working with Denodo:

* [Denodo Support Utilities](./scripts/denodo-support-utilities/): this tool enables you to interact with the Denodo Support Site using commands in your command-line shell.
* [Denodo Incremental Deployment](./scripts/denodo-incremental-deployment/): automation framework for code promotion within the Denodo Major versions and also moving code from one major version to another version

### Templates

In this subproject you can find useful templates for working with Denodo:

* [Denodo Embedded MPP Templates](./templates/denodo-embedded-mpp/): templates for deploying the Denodo Embedded MPP in Azure and AWS.
* [Denodo Data Products Lifecycle](./templates/data-product-roles/): creation scripts of the roles defined in [this knowledge-base article](https://community.denodo.com/kb/en/view/document/Denodo%20Data%20Products%20Lifecycle).
* [Spring Batch Samples](./templates/spring-batch-samples/): template project using Spring Batch + Denodo Platform.


# Join the Denodo Community

- Star the repo
- Join the [Denodo Community](https://community.denodo.com/) and ask questions on the [Q&A](https://community.denodo.com/answers)
- Download [Denodo Express](https://community.denodo.com/express/download)
- [Contributions](https://github.com/denodo/denodocommunity-resources/contribute) are, of course, most welcome! 
- Track [issues](https://github.com/denodo/denodocommunity-resources/issues/new/choose) 

## Denodo Community Resources License

This project is distributed under **Apache License, Version 2.0**. 

See [LICENSE](LICENSE)

## Denodo Community Resources Support

This project is supported by **Denodo Community**. 

See [SUPPORT](SUPPORT.md)

