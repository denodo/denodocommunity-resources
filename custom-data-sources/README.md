<!--
title: 'Denodo Community Custom Functions'
description: 'This subproject maintains some custom functions that any user can use in his/her own Denodo installation.
layout: Doc
authorLink: ''
authorName: 'Denodo Community'
authorAvatar: ''
collaborators:
-->

# Denodo Community Custom Data Sources

[Denodo](https://www.denodo.com/) is the leading logical data management platform. It establishes a unified data accessibility framework that provides data consumers with real-time insights from diverse data sources.

This project mantains some sample **custom data sources** that any user can use in his/her own Denodo Platform installation.

## Custom Data Sources

This is the list of available Custom Data Sources created in Java code:

* **[ExtractFileMetadata](./com/denodo/vdp/custom/cw/metadata/ExtractFileMetadata.java)**: this is a sample custom data source to show how to extract metadata information available in files using Apache Tika.
    * It requires the `filepath` as input parameter of the data source.
    * The output schema returns a list of key/value pairs with the metadata information of the input file, for example:
        | metadata_key | metadata_value |
        | ----------- | ----------- |
        | date | 2025-10-10T12:39:00Z |
        | dc:creator | jsmith |
        | Last-Modified | 2025-10-10T12:39:00Z |
        | Content-Type | application/pdf |

## How To Import the Denodo Community Custom Data Sources

For importing, the custom data sources included in this subproject, please download the generated JAR file and read the official documentation for the instructions on how ti immport that JAR file into your Denodo Platform installation: https://community.denodo.com/docs/html/browse/latest/en/vdp/administration/creating_data_sources_and_base_views/custom_sources/custom_sources.

In summary you will have to:

* First, you need to upload to Virtual DataPort the JAR file. To do this, follow these steps:
    * Click the menu `File > Extension management` in Design Studio.
    * In the tab `Extensions`, click Import, select the jar file, and click Ok. 
    * After uploading the jar file, click the menu `File > New > Data source > Custom`.

## Denodo Community Resources License

This project is distributed under **Apache License, Version 2.0**. 

See [LICENSE](../LICENSE)

## Denodo Community Resources Support

This project is supported by **Denodo Community**. 

See [SUPPORT](../SUPPORT.md)

