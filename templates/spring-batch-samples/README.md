# Spring Batch & MyBatis Denodo Integration

This project demonstrates how to integrate **Spring Batch** with **MyBatis** for reading and writing data from and to **Denodo Virtual DataPort (VDP)** using VQL queries.

## Overview

The goal of this project is to implement a batch job that:
- Retrieves data from Denodo using VQL
- Applies basic processing logic
- Writes the results back to Virtual DataPort

This integration leverages:
- **Spring Batch** for batch processing orchestration
- **MyBatis** for executing VQL queries and mapping results to Java objects
- **Denodo JDBC Driver** for communication with VDP

## Setup Instructions

This is a Maven-based project, after pulling the project into your IDE (e.g. IntelliJ) synch the pom.xml file to download and install dependencies

### 1. Install the Denodo JDBC Driver in the Local Maven Repository

Since the Denodo JDBC driver is not publicly available on Maven Central, it must be manually installed into your local Maven repository:

```bash
mvn install:install-file ^
  -Dfile="/path/to/denodo-vdp-jdbcdriver.jar" ^
  -DgroupId=com.denodo ^
  -DartifactId=denodo-vdp-jdbcdriver ^
  -Dversion=9.2.0 ^
  -Dpackaging=jar
```
  
  
### 2. SSL/TLS certficates

For self-signed or CA-unrecognized Virtual DataPort SSL certificates, configure the JVM Truststore by adding the certificate to your IDE's JVM or using these JVM options:

```Bash
-Djavax.net.ssl.trustStore="path/to/your/cacerts" -Djavax.net.ssl.trustStorePassword="changeit"
```

Replace the paths and password accordingly for the JVM to trust the Denodo server.