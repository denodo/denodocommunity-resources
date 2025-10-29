# Observability and Monitoring

This subproject includes useful templates for deploying Observability and Monitoring frameworks to track the Denodo Platform components health.  

## Denodo Embedded MPP

**Prometheus** and **Grafana** are widely used open-source tools for monitoring and observability.

- [Prometheus](https://prometheus.io/) focuses on collecting and storing metrics in a time-series database, using its own query language (PromQL) and supporting alerts through Alertmanager.
- [Grafana](https://prometheus.io/), on the other hand, provides powerful visualization capabilities, allowing users to build dashboards and analyze data from Prometheus and other sources.

### Setup Instructions

Please review the [Monitoring the Denodo MPP with Prometheus and Grafana](https://community.denodo.com/kb/en/view/document/Monitoring%20the%20Denodo%20MPP%20with%20Prometheus%20and%20Grafana) Knowledge Base article for configuring the agents and alerts, for building a Denodo Embedded MPP Dashboard in Grafana.

List of templates: 
* [prometheus-embedded-mpp-values.yaml](prometheus-embedded-mpp-values.yaml): template file for a basic deployment of Prometheus in AWS.   
  
* [grafana-embedded-mpp-dashboard.yaml](grafana-embedded-mpp-dashboard.yaml): this template includes a configmap with a JSON specification of the dashboards we want to add to Grafana on pod creation.