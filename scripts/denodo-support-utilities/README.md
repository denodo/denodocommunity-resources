<!--
title: 'Denodo Support Utilities'
description: 'This project maintains some sample data sources that can be used to build a local testing environment of different technologies that can be used later for Denodo training, for testing purposes or for having a base for your Denodo projects.
layout: Doc
authorLink: ''
authorName: 'Denodo Community'
authorAvatar: ''
collaborators: Javier Diez
-->

# Denodo Support Utilities

## Introduction

The Denodo Support Command Line Interface (denodo-support) is an open source tool that enables you to interact with the Denodo Support Site using commands in your command-line shell:
* **Linux / macOS**: use common shell programs such as bash to run commands.
* **Windows**: run commands at the Windows command prompt (CMD) or PowerShell. 
                 _NOTE:_ It does not include all the functionalities of the Linux version!

The Denodo Support CLI provides direct access to the public APIs of the Denodo Support Site.

## Installation

This section describes how to install the Denodo Support CLI on your computer. The Denodo Support CLI commands have dependencies on other third-party packages, please check the prerequisites section before using this tool.

### Prerequisites for Linux

* You must be able to extract or "unzip" the downloaded package **Denodo Support Utilities.zip**. If your operating system doesn't have the built-in unzip command, use an equivalent.
* The Denodo Support CLI uses **cut, grep, sed, jq, curl and wget**. These tools are included by default in most major distributions of Linux.
* The tool also needs a **Java Runtime Environment 1.8 or greater** installed in your system.
* We support the Denodo Support CLI on versions of recent distributions of CentOS, Ubuntu and Amazon Linux 2.

### Prerequisites for Windows

* You must be able to extract or "unzip" the downloaded package **Denodo Support Utilities.zip**. If your operating system doesn't have the built-in unzip command, use an equivalent.
* The Denodo Support CLI needs a **Java Runtime Environment 1.8 or greater** installed in your system and the JAVA_HOME environment variable, pointing to that directory, set and exported.

### Install the Denodo Support CLI 

Follow these steps to install the Denodo Support CLI:

1. Download the component Denodo Support Utilities from [here](https://github.com/denodo/denodocommunity-resources/releases/latest)
2. Move the file to your server.
3. Uncompress the zip file by executing:
```bash
$ unzip Denodo.Support.Utilities.v1.3.2.zip
Archive:  Denodo.Support.Utilities.v1.3.2.zip
   creating: denodo-support-utils/
   creating: denodo-support-utils/bin/
  inflating: denodo-support-utils/bin/denodo-support
  inflating: denodo-support-utils/bin/port_tester.bat
  inflating: denodo-support-utils/bin/support_info.bat
   creating: denodo-support-utils/lib/
  inflating: denodo-support-utils/lib/denodo-support-utils-1.3.jar
  inflating: denodo-support-utils/LICENSE
 extracting: denodo-support-utils/NOTICE
  inflating: denodo-support-utils/README.md
```
4. Remove the zip file:
```bash
$ rm Denodo.Support.Utilities.v1.3.2.zip
```
5. Go to the denodo-support-utils/bin folder and confirm the installation (example in Linux):
```bash
$ cd denodo-support-utils/bin/
$ chmod +x denodo-support
$ ./denodo-support --version

denodo-support v1.3.2
Copyrights - Denodo Technologies
Terms of Use: https://www.denodo.com/en/terms-use
```


### Configure the Denodo Support CLI in Linux

This section explains how to configure the authentication that the Denodo Support CLI uses to interact with the Denodo Support Site.

For setting your credentials, use the `--configure` option. 
```bash
$ ./denodo-support --configure
```

When you enter this parameter, the Denodo Support CLI prompts you for three pieces of information:
* Denodo Client ID
* Denodo Client Secret
* JAVA home

The following example shows sample values. Replace them with your own values as described in the following sections.

```bash
$ ./denodo-support --configure

Denodo Client ID []: 9tmtyViaek9XLkGacU9LDwi0KlpklBi6
Denodo Client Secret []: **********
JAVA home []: /opt/denodo/jre
```

#### Denodo Client ID and Denodo Client Secret
In this section we will focus on the first two parameters. The Denodo Support CLI stores this information in a configuration file.

Access keys consist of a Denodo Client ID key and Denodo Client Secret key, which are used to connect to the external API of the Denodo Support Site. If you don't have access keys, you can create them from the Denodo Support Site interface.

The keys will be sent by email to your inbox, you cannot view or recover the access keys again in the Support Site. If you need new keys because you have removed the email with the keys, you have to generate new keys following the same procedure (that action will invalidate all the previous generated keys).

These parameters are used when the option to **list or download Denodo items** (installers, updates, hotfixes, DenodoConnects and drivers) is used .

To create or regenerate the Denodo Support access keys, follow these steps:

1. Sign in to the Denodo Support Site and open the Licenses section at https://support.denodo.com/resources/license/list.
2. Click on the **Generate Credentials / Regenerate Credentials** button.
3. You will receive an email with the Support Site credentials. Your credentials will look something like this (these are fake credentials):
    * Denodo Client ID: 9tmtyek9XLkGacwi0KlpklBi6
    * Denodo Client Secret: ao2mH58ybGjdKNcv1
4. Please store the keys in a secure location and delete the email.
5. When you create the keys, they are active by default, so you can use them for configuring the Denodo Support CLI.

##### Where are configuration settings stored?

The Denodo Support CLI stores sensitive credential information for connecting to the Denodo Support Site in a folder named `.denodo` in your home directory. The name of the generated file is `denodo-support-config`.

#### JAVA Home
The third parameter requested by the configuration is the JAVA HOME. The recommendation is to use the path to the directory of the Java Runtime Environment (JRE) used by the Denodo Platform installation, for example, `/opt/denodo/jre`

This parameter is used when the option to show the **IP addresses and the number of CPUs** or the option to **test ports** are used.

## Command line options

**ONLY FOR LINUX SCRIPT!** In the Denodo Support CLI you can use the following command line options:

### Main Options

`--help` It shows the help text. Example:
```bash
$ ./denodo-support --help

Usage: denodo-support [option] <param>
OPTIONS
 --help           This help text
 --version        Show version number and quit
 --configure      Set your Denodo Repository credentials
[...]
```

`--version` Shows the version number and quit. Example:
```bash
$ ./denodo-support --version

denodo-support v1.3.2
Copyrights (c) Denodo Technologies
Terms of Use: https://www.denodo.com/en/terms-use
```

`--configure` It sets your Denodo Support Site Repository credentials and the JAVA home. Example:
```bash
$ ./denodo-support --configure

Denodo Client ID []: 9tmtyViaek9XLkGacU9LDwi0KlpklBi6
Denodo Client Secret []: **********
JAVA home []: /opt/denodo/jre
```

### Options for Getting the Information of the Host

`-cei [-j <java home>]`
* `-c` It prints the number of cores of the server. 
* `-e` It prints the encoding of the server. 
* `-i` It prints the IP addresses of the server and the canonical names. 

**Note**: in Linux environments, it needs the JAVA Home parameter to be set in the configuration or passing it using the `-j` argument. Example:
```bash
$ ./denodo-support -cei -j /opt/denodo/jre

File encoding   : UTF8
Byte encoding   : UTF8
Default charset : utf-8
Default locale  : en_US

List of network interfaces:
 Loopback: 127.0.0.1, 0:0:0:0:0:0:0:1
 Other: fe80:0:0:0:7c4b:b984:06c5:b1ab, 192.168.57.2

Canonical host names:
HOSTNAME.denodo.loc, ANOTHERHOSTNAME.denodo.loc

Cores: 4
```

**Note for Windows**: please use the alternate `support_info.bat` script. it needs the JAVA_HOME variable to be set in your system. Example:
```bash
denodo-support-Utils\bin> support_info.bat
File encoding   : Cp1252
Byte encoding   : Cp1252
Default charset : windows-1252
Default locale  : en_US

Network interfaces:

 Loopback: 127.0.0.1, 0:0:0:0:0:0:0:1
 Other: fe80:0:0:0:7c4b:b984:06c5:b1ab, 192.168.57.2


Canonical host names:
HOSTNAME.denodo.loc, ANOTHERHOSTNAME.denodo.loc

Cores: 4

Press any key to continue . . .
```

### Options for testing the Ports of a Host

`-p <ports> [-h <hostname>] [-w <wait timeout>]` ONLY FOR LINUX SCRIPT. Test if a port is accessible or not. 

* `ports` is a list of ports separated by commas (e.g. 9999,9996,9090). 
* `hostname` is the servername or the IP address of the server to connect (this parameter is optional, the default value is localhost). 
* `wait timeout` is the maximum timeout waiting for the connection to the hostname in seconds (this parameter is optional, the default value is 5 seconds). 

**Note**: in Linux environments, it needs the JAVA Home parameter to be set in the configuration (see JAVA Home) or passing it using the `-j` argument. Example:
```bash
$ ./denodo-support -p 9999,9090 -h 1.2.3.4 -j /opt/denodo/jre

Checking ports...
Port 9999 on 1.2.3.4 is reachable!
Port 9090 on 1.2.3.4 is not reachable!; reason: timeout while attempting to reach node demo.com on port 9090
```

**Note for Windows**: please use the alternate `port_tester.bat` script. it needs the JAVA_HOME variable to be set in your system. Also you have to use double quotes in the first two parameters. Example:
```bash
denodo-support-Utils\bin> port_tester.bat “9999,9090” “demo.com” 10


Checking ports...
Port 9999 on demo.com is reachable!
Port 9090 on demo.com is not reachable!; reason: timeout while attempting to reach node demo.com on port 9090

Press any key to continue . . .
```

### Options for Listing the Available Denodo Platform Items

`-t <item type> [-x <extra filter>] [-v <denodo version>] [-u <denodo client id>] [-s <denodo secret>]` ONLY FOR LINUX SCRIPT. List the latest items by item type and Denodo version. 

* `item type` can be `installer`, `update`, `beta-update`, `hotfix`, `denodoconnect-enterprise`, `denodoconnect-open` or `driver`

* `extra filter` if used, it has to be the vale `version` (this parameter is <u>optional</u>, to return extra information of the item, like the item version)
  
* `denodo version` can be 6.0, 7.0, 8.0 or 9 (this parameter is <u>optional</u>, the default value is 9).

* `denodo client id` (this parameter is <u>optional</u>, to pass the denodo client id as argument if it was not configured using the `--configure` option).

* `denodo secret` (this parameter is <u>optional</u>, to pass the denodo secret as argument if it was not configured using the `--configure` option).

#### Examples 
```bash
-- Get the list of Denodo 9 installers passing the user credentials as parameters


$ ./denodo-support -t installer -u AXe45h -s 21Hyxd8

Authenticating... OK!
Getting the installer list...
NAME
===============================
denodo-container-9
denodo-install-9-ga-linux64
denodo-install-9-ga-win64
denodo-install-solutionmanager-9-ga-linux64
denodo-install-solutionmanager-9-ga-win64


[...]
```


```bash
-- Get the list of Denodo 8.0 updates


$ ./denodo-support -t update -v 8.0 -x version

Authenticating... OK!
Getting the update list of Denodo 8.0...
ITEMS
====================
denodo-solutionmanager-v80-update-20210209   {VERSION=20210217}
denodo-solutionmanager-v80-update-20210715   {VERSION=20210715}
denodo-v80-update-20200807   {VERSION=20200807}
denodo-v80-update-20210209   {VERSION=20210217}
[...]
```

### Options for Downloading a Denodo Platform Item

`-t <item type> [-v <denodo version>] -n <item name> [-x <extra filter>] [-d <download folder>] [-u <denodo client id>] [-s <denodo secret>]` ONLY FOR LINUX SCRIPT. It downloads the item name to the folder specified in the download folder parameter.

* `item type` can be `installer`, `update`, `beta-update`, `hotfix`, `denodoconnect-enterprise`, `denodoconnect-open` or `driver`

* `denodo version` can be 6.0, 7.0, 8.0 or 9 (this parameter is optional, the default value is 9).

* `item name` is the name of the item selected for download (if the name has spaces, it has to be surrounded by double quotes).

* `extra filter` is the specific version of the selected item for download (it is optional, by default the script downloads the latest version of the item)
  
* `download folder` is the download destination folder (it is optional, by default the script downloads the item to the current directory).

* `denodo client id` (this parameter is <u>optional</u>, to pass the denodo client id as argument if it was not configured using the `--configure` option).

* `denodo secret` (this parameter is <u>optional</u>, to pass the denodo secret as argument if it was not configured using the `--configure` option).


#### Examples 
```bash
-- Download the Denodo 8.0 installer for Linux
$ ./denodo-support -t installer -v 8.0 -n denodo-install-8.0-ga-linux64

Authenticating... OK!
Getting the download URL of item denodo-install-8.0-ga-linux64... OK!

IMPORTANT! READ THIS:
=====================
Recommended version for 64-bit Linux platforms.
The installation will use an embedded Java Runtime Environment.

Important: if upgrading from a previous version, refer to the most recent "Upgrade Guide" as the upgrade process has changed since the last version.
=====================

Download is starting:
HTTP request sent, awaiting response... 200 OK
Length: 2149288801 (2.0G) [binary/octet-stream]
Saving to: ‘./denodo-install-8.0-ga-linux64.zip’

./denodo-install-8.0-ga-linux64.zip      2%[=              ]  15.64M  6.37MB/s
```
```bash
-- Download the Denodo 6.0 hotfix 20181122 to the /home directory
$ ./denodo-support -t hotfix -v 6.0 -n denodo-v60-hotfix-20181122 -d /home/

Authenticating... OK!
Getting the download URL of item denodo-v60-hotfix-20181122... OK!

IMPORTANT! READ THIS:
=====================
Denodo Platform 6.0 Hotfix 20181122
=====================

Download is starting:
HTTP request sent, awaiting response... 200 OK
Length: 3895481 (3.7M) [application/zip]
Saving to: ‘/home/denodo-v60-hotfix-20180814.zip’

/home/denodo-v60-hotfix-2018081 100%[===========>]   3.71M  4.53MB/s   in 0.8s

‘/home/denodo/denodo-v60-hotfix-20181122.zip’ saved [3895481/3895481]
```
```bash
-- Download the version 0.8.1 of the Denodo AI SDK component of the Denodo Platform 9
$ ./denodo-support -t denodoconnect-enterprise -n "Denodo AI SDK" -x 0.8.1

Authenticating... OK!
Getting the download URL of item Denodo AI SDK and version 0.8.1... OK!

IMPORTANT! READ THIS:
=====================
This package includes the Denodo AI SDK image, configuration templates and data needed to execute an example Chatbot included in the image.
=====================

Download is starting:
HTTP request sent, awaiting response... 200 OK
Length: 299715876 (286M) [application/octet-stream]
Saving to: ‘./Denodo AI SDK.zip’

./Denodo AI SDK.zip  100%[===========>] 285.83M  39.1MB/s    in 7.4s

‘./Denodo AI SDK.zip’ saved [299715876/299715876]
```
