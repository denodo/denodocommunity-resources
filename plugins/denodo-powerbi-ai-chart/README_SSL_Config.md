# SSL Certificate Generation and Configuration

> If you don't have a **SSL certificate signed by a Certificate Authority (CA)**, you will need to create you own self-signed certificate to autrhentify your server Common Name (CN).
> 
> To create a self-signed certificate that mimics a CA-signed certificate, you'll need to act as your own Certificate Authority (CA). Here's how you can do it step-by-step and what changes to make in your configuration file.
>
> **You will need a configuration file to create your certificate.** You can find and edit the sample configuration file **[openssl.conf](/openssl.cnf)**


## Prerequisite OpenSSL

You will need to obtain OpenSSL from the [OpenSSL download page](https://openssl-library.org/source/index.html) or from [GitHub OpenSSL](https://github.com/openssl/openssl). Then you will need to build and install it on your operating system. 

>**Note:** It is not recommended to use a precompiled version of OpenSSL as you cannot always trust the provider.   

## Creating a Self-Signed Certificate Signed by a CA

You will need to go through the following steps:
- Root Certificate (MyOwnRootCA.crt): Acts as your trusted CA.
- CSR (server.csr): Represents the request for a certificate, based on your configuration file.
- Signed Certificate (server.crt): Your server's certificate, signed by the root CA.

### Generate a Root Certificate (CA Certificate):
First, you will need to create a private key and a self-signed root certificate for your Certificate Authority (CA).

**Generate a private key for your CA**
```shell
openssl genrsa -out my_rootCA.key 2048
```
**Create a self-signed root certificate**
```shell
openssl req -x509 -new -nodes -key my_rootCA.key -sha256 -days 3650 -out my_rootCA.crt -subj "/CN=MyRootCA"
```

### Create a Certificate Signing Request (CSR):
**Generate the Server Private Key**
```shell
openssl genrsa -out my_server.key 2048
```
**Create a CSR Using the Config File**
Use the provided configuration file to generate the CSR for the server certificate.

```shell
openssl req -new -key my_server.key -out my_server.csr -config openssl.cnf
```

**Sign the CSR with your Root CA**
You will use the root CA to sign the CSR and generating a certificate for your server.
```shell
openssl x509 -req -in my_server.csr -CA my_rootCA.crt -CAkey my_rootCA.key -CAcreateserial -out my_server.crt -days 365 -sha256 -extfile openssl.cnf -extensions v3_req
```

**Verify the Generated Certificate**
```shell
openssl x509 -in my_server.crt -text -noout
```

### Install and Use the Certificates
Yo will need to install your root CA certificate in your trusted store.
**Install Root CA in Trusted Store:**

- On Windows: Use `certmgr.msc` and import **my_rootCA.crt** into "Trusted Root Certification Authorities."
- On macOS: Use Keychain Access to import the certificate.
- On Linux: Place rootCA.crt in `/usr/local/share/ca-certificates/` and run `sudo update-ca-certificates`.
- 
**Configure Server with Signed Certificate:**
- Use **my_server.crt** (certificate) and **my_server.key** (private key) in your server configuration.
- Use the signed server certificate for your application.