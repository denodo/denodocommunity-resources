#!/bin/bash
 
# Set username and password
user="admin"
pass="admin"
pair="${user}:${pass}"
 
# File path to VQL file
Filename="/home/nivisha/test.vql"
 
# Read file content and encode to base64
base64string=$(base64 -w 0 "$Filename")
 
# Encode username:password pair to Base64
basicAuthValue=$(echo -n "$pair" | base64)
echo "$base64string"
# Create JSON body
body=$(cat <<EOF
{
  "name": "dynamic_revision",
  "description": "dynamic_revision",
  "content": "$base64string"
}
EOF
)
 
# Send the POST request
response=$(curl -s -X POST 'http://192.168.13.26:10090/revisions/loadFromVQL' \
	  -H "Content-Type: application/json" \
  -H "Authorization: Basic $basicAuthValue" \
  -d "$body")
 
# Print the JSON response
echo "$response"
