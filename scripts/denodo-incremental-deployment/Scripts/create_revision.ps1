$user = "admin"
$pass = "admin"
$pair = "${user}:${pass}"


$Filename="C:\Denodo\DenodoPlatform8.0_target_incre_depl\work\scheduler\data\csv\auto_generated_vql.vql"

$base64string = [Convert]::ToBase64String([IO.File]::ReadAllBytes($Filename))

#Encode the string to the RFC2045-MIME variant of Base64, except not limited to 76 char/line.
$bytes = [System.Text.Encoding]::ASCII.GetBytes($pair)
$base64 = [System.Convert]::ToBase64String($bytes)

#Create the Auth value as the method, a space, and then the encoded pair Method Base64String
$basicAuthValue = "Basic $base64"
$headers = New-Object "System.Collections.Generic.Dictionary[[String],[String]]"
$headers.Add("Content-Type", "application/json")

$headers.Add("Authorization", "$basicAuthValue")

$body = "{
`n`"name`":`"dynamic_revision`",
`n`"description`":`"dynamic_revision`",
`n`"content`": `"$base64string`"
`n}"

$response = Invoke-RestMethod 'http://127.0.0.1:10090/revisions/loadFromVQL' -Method 'POST' -Headers $headers -Body $body
$response | ConvertTo-Json